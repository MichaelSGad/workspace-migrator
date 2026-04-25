import io
import time

from googleapiclient.errors import HttpError
from googleapiclient.http import MediaIoBaseDownload, MediaIoBaseUpload
from tenacity import retry, retry_if_exception_type, stop_after_attempt, wait_exponential

from .auth import DRIVE_SOURCE_SCOPES, DRIVE_TARGET_SCOPES, build_service
from .base import BaseMigrator, ProgressCallback
from .progress import Progress

RETRYABLE_STATUS = {429, 500, 502, 503, 504}

GOOGLE_NATIVE_TYPES = {
    "application/vnd.google-apps.document",
    "application/vnd.google-apps.spreadsheet",
    "application/vnd.google-apps.presentation",
    "application/vnd.google-apps.drawing",
    "application/vnd.google-apps.form",
    "application/vnd.google-apps.site",
}

SKIP_TYPES = {
    "application/vnd.google-apps.folder",
    "application/vnd.google-apps.shortcut",
    "application/vnd.google-apps.map",
}

retry_api = retry(
    reraise=True,
    stop=stop_after_attempt(5),
    wait=wait_exponential(multiplier=2, min=2, max=60),
    retry=retry_if_exception_type(HttpError),
)


class DriveMigrator(BaseMigrator):
    def __init__(self, source_user, target_user, source_sa, target_sa, progress_dir,
                 on_progress: ProgressCallback | None = None):
        super().__init__(source_user, target_user, source_sa, target_sa, progress_dir, on_progress)
        progress_path = f"{progress_dir}/drive_{source_user}.json"
        self.progress = Progress(progress_path)
        self.src = build_service("drive", "v3", source_sa, source_user, DRIVE_SOURCE_SCOPES)
        self.dst = build_service("drive", "v3", target_sa, target_user, DRIVE_TARGET_SCOPES)

    @retry_api
    def _list_files(self, query, page_token=None):
        return self.src.files().list(
            q=query,
            pageToken=page_token,
            pageSize=100,
            fields="nextPageToken, files(id, name, mimeType, parents, size)",
            includeItemsFromAllDrives=False,
            supportsAllDrives=False,
        ).execute()

    def _iter_all_files(self):
        page_token = None
        while True:
            resp = self._list_files("trashed = false", page_token)
            yield from resp.get("files", [])
            page_token = resp.get("nextPageToken")
            if not page_token:
                break

    def _build_folder_tree(self) -> dict:
        """Returnerer dict: src_folder_id → dst_folder_id"""
        folder_map: dict[str, str] = {}

        folders = []
        page_token = None
        while True:
            resp = self._list_files("mimeType = 'application/vnd.google-apps.folder' and trashed = false", page_token)
            folders.extend(resp.get("files", []))
            page_token = resp.get("nextPageToken")
            if not page_token:
                break

        created: dict[str, str] = {}

        def ensure_folder(folder):
            if folder["id"] in created:
                return created[folder["id"]]

            parent_ids = folder.get("parents", [])
            dst_parent = None
            if parent_ids:
                parent_id = parent_ids[0]
                parent = next((f for f in folders if f["id"] == parent_id), None)
                if parent:
                    dst_parent = ensure_folder(parent)

            body = {
                "name": folder["name"],
                "mimeType": "application/vnd.google-apps.folder",
            }
            if dst_parent:
                body["parents"] = [dst_parent]

            result = self.dst.files().create(body=body, fields="id").execute()
            created[folder["id"]] = result["id"]
            return result["id"]

        for folder in folders:
            ensure_folder(folder)

        folder_map.update(created)
        return folder_map

    @retry_api
    def _copy_native(self, file_id, name, dst_parent):
        body = {"name": name}
        if dst_parent:
            body["parents"] = [dst_parent]
        return self.dst.files().copy(fileId=file_id, body=body, fields="id", supportsAllDrives=False).execute()

    def _copy_binary(self, file_id, name, mime_type, dst_parent):
        request = self.src.files().get_media(fileId=file_id, supportsAllDrives=False)
        buf = io.BytesIO()
        downloader = MediaIoBaseDownload(buf, request)
        done = False
        while not done:
            _, done = downloader.next_chunk()

        buf.seek(0)
        media = MediaIoBaseUpload(buf, mimetype=mime_type, resumable=True)
        body = {"name": name, "mimeType": mime_type}
        if dst_parent:
            body["parents"] = [dst_parent]
        return self.dst.files().create(body=body, media_body=media, fields="id").execute()

    def run(self) -> dict:
        self._report(0, 0, 0, 0, "Bygger mappestruktur…")
        folder_map = self._build_folder_tree()

        total = migrated = skipped = failed = 0
        all_files = list(self._iter_all_files())
        total = len(all_files)
        self._report(total, 0, 0, 0, f"Fandt {total} filer")

        for f in all_files:
            file_id = f["id"]
            mime_type = f["mimeType"]
            name = f["name"]

            if mime_type == "application/vnd.google-apps.folder":
                skipped += 1
                continue

            if mime_type in SKIP_TYPES:
                skipped += 1
                continue

            if self.progress.is_done(file_id):
                skipped += 1
                self._report(total, migrated, skipped, failed, "")
                continue

            parent_ids = f.get("parents", [])
            dst_parent = folder_map.get(parent_ids[0]) if parent_ids else None

            try:
                if mime_type in GOOGLE_NATIVE_TYPES:
                    self._copy_native(file_id, name, dst_parent)
                else:
                    self._copy_binary(file_id, name, mime_type, dst_parent)

                self.progress.mark_done(file_id)
                migrated += 1

                if migrated % 10 == 0:
                    self._report(total, migrated, skipped, failed, f"Kopieret {migrated}/{total} filer")
                    time.sleep(0.2)

            except HttpError as e:
                failed += 1
                self.progress.mark_failed(file_id, f"HTTP {e.resp.status}: {e}")
                self._report(total, migrated, skipped, failed, f"Fejl ved '{name}': {e.resp.status}")
            except Exception as e:
                failed += 1
                self.progress.mark_failed(file_id, str(e))
                self._report(total, migrated, skipped, failed, f"Fejl ved '{name}': {e}")

        self._report(total, migrated, skipped, failed,
                     f"Drive færdig. {migrated} kopieret, {skipped} sprunget over, {failed} fejlede")
        return {"total": total, "migrated": migrated, "skipped": skipped, "failed": failed}
