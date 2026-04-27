import tempfile
import threading
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

CHUNK_SIZE = 10 * 1024 * 1024  # 10 MB

retry_api = retry(
    reraise=True,
    stop=stop_after_attempt(5),
    wait=wait_exponential(multiplier=2, min=2, max=60),
    retry=retry_if_exception_type(HttpError),
)


class DriveMigrator(BaseMigrator):
    def __init__(self, source_user, target_user, source_sa, target_sa, progress_dir,
                 on_progress: ProgressCallback | None = None,
                 stop_event: threading.Event | None = None):
        super().__init__(source_user, target_user, source_sa, target_sa, progress_dir,
                         on_progress, stop_event)
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
        folder_map: dict[str, str] = {}
        folders = []
        page_token = None
        while True:
            resp = self._list_files(
                "mimeType = 'application/vnd.google-apps.folder' and trashed = false", page_token
            )
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
                parent = next((f for f in folders if f["id"] == parent_ids[0]), None)
                if parent:
                    dst_parent = ensure_folder(parent)
            body = {"name": folder["name"], "mimeType": "application/vnd.google-apps.folder"}
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
        return self.dst.files().copy(
            fileId=file_id, body=body, fields="id", supportsAllDrives=False
        ).execute()

    def _copy_binary(self, file_id, name, mime_type, dst_parent):
        """Download via chunked streaming to a temp file, then upload resumably.
        Using disk instead of BytesIO prevents OOM on large files."""
        request = self.src.files().get_media(fileId=file_id, supportsAllDrives=False)
        with tempfile.TemporaryFile() as tmp:
            downloader = MediaIoBaseDownload(tmp, request, chunksize=CHUNK_SIZE)
            done = False
            while not done:
                if self._should_stop():
                    raise InterruptedError("Migration annulleret")
                _, done = downloader.next_chunk()
            tmp.seek(0)
            media = MediaIoBaseUpload(tmp, mimetype=mime_type, resumable=True, chunksize=CHUNK_SIZE)
            body = {"name": name, "mimeType": mime_type}
            if dst_parent:
                body["parents"] = [dst_parent]
            return self.dst.files().create(body=body, media_body=media, fields="id").execute()

    @retry_api
    def _target_file_exists(self, target_id: str) -> bool:
        try:
            self.dst.files().get(fileId=target_id, fields="id").execute()
            return True
        except HttpError as e:
            if e.resp.status == 404:
                return False
            raise

    def run(self) -> dict:
        self._report(0, 0, 0, 0, "Bygger mappestruktur…")
        folder_map = self._build_folder_tree()

        # Resolve pending items from a previous interrupted run.
        # If the target file still exists, we mark it done. Otherwise we re-upload.
        pending = self.progress.pending_items()
        if pending:
            self._report(0, 0, 0, 0, f"Tjekker {len(pending)} afbrudte filer…")
            for file_id, meta in pending.items():
                target_id = meta.get("target_id")
                if target_id and self._target_file_exists(target_id):
                    self.progress.mark_done(file_id, meta)
                else:
                    self.progress.mark_failed(file_id, "Afbrudt tidligere — prøver igen")

        total = migrated = skipped = failed = 0
        all_files = list(self._iter_all_files())
        total = len(all_files)
        self._report(total, 0, 0, 0, f"Fandt {total} filer")

        for f in all_files:
            if self._should_stop():
                self._report(total, migrated, skipped, failed, "Migration stoppet af bruger")
                break

            file_id = f["id"]
            mime_type = f["mimeType"]
            name = f["name"]

            if mime_type in (SKIP_TYPES | {"application/vnd.google-apps.folder"}):
                skipped += 1
                continue

            if self.progress.is_done(file_id):
                skipped += 1
                self._report(total, migrated, skipped, failed, "")
                continue

            parent_ids = f.get("parents", [])
            dst_parent = folder_map.get(parent_ids[0]) if parent_ids else None

            try:
                self.progress.mark_pending(file_id, {"name": name})

                if mime_type in GOOGLE_NATIVE_TYPES:
                    result = self._copy_native(file_id, name, dst_parent)
                else:
                    result = self._copy_binary(file_id, name, mime_type, dst_parent)

                self.progress.mark_done(file_id, {"target_id": result.get("id"), "name": name})
                migrated += 1

                if migrated % 10 == 0:
                    self._report(total, migrated, skipped, failed, f"Kopieret {migrated}/{total} filer")
                    time.sleep(0.2)

            except InterruptedError:
                break
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

    def verify(self) -> dict:
        def _count(svc):
            total = 0
            token = None
            while True:
                r = svc.files().list(
                    q="trashed = false",
                    pageToken=token,
                    pageSize=1000,
                    fields="nextPageToken, files(id)",
                    includeItemsFromAllDrives=False,
                ).execute()
                total += len(r.get("files", []))
                token = r.get("nextPageToken")
                if not token:
                    break
            return total

        src_count = _count(self.src)
        dst_count = _count(self.dst)
        diff = src_count - dst_count
        status = "ok" if diff == 0 else ("mangler" if diff > 0 else "overskud")
        return {
            "service": "drive",
            "source_count": src_count,
            "target_count": dst_count,
            "diff": diff,
            "status": status,
        }
