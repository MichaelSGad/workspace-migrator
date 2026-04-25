import time
from typing import Iterator

from googleapiclient.errors import HttpError
from tenacity import retry, retry_if_exception_type, stop_after_attempt, wait_exponential

from .auth import GMAIL_SOURCE_SCOPES, GMAIL_TARGET_SCOPES, build_service
from .base import BaseMigrator, ProgressCallback
from .progress import Progress

PRESERVED_SYSTEM_LABELS = {"INBOX", "STARRED", "IMPORTANT", "UNREAD"}
RETRYABLE_STATUS = {429, 500, 502, 503, 504}


class RetryableError(Exception):
    pass


def _is_retryable(exc):
    if isinstance(exc, RetryableError):
        return True
    if isinstance(exc, HttpError):
        return exc.resp.status in RETRYABLE_STATUS
    return False


retry_api = retry(
    reraise=True,
    stop=stop_after_attempt(5),
    wait=wait_exponential(multiplier=2, min=2, max=60),
    retry=retry_if_exception_type((HttpError, RetryableError)),
)


class GmailMigrator(BaseMigrator):
    def __init__(self, source_user, target_user, source_sa, target_sa, progress_dir,
                 on_progress: ProgressCallback | None = None, skip_spam=True, skip_trash=True):
        super().__init__(source_user, target_user, source_sa, target_sa, progress_dir, on_progress)
        self.skip_spam = skip_spam
        self.skip_trash = skip_trash
        progress_path = f"{progress_dir}/gmail_{source_user}.json"
        self.progress = Progress(progress_path)
        self.src = build_service("gmail", "v1", source_sa, source_user, GMAIL_SOURCE_SCOPES)
        self.dst = build_service("gmail", "v1", target_sa, target_user, GMAIL_TARGET_SCOPES)

    @retry_api
    def _list_labels(self, svc):
        return svc.users().labels().list(userId="me").execute().get("labels", [])

    @retry_api
    def _create_label(self, svc, body):
        return svc.users().labels().create(userId="me", body=body).execute()

    def sync_labels(self) -> dict:
        src_labels = self._list_labels(self.src)
        dst_labels = self._list_labels(self.dst)
        dst_by_name = {lbl["name"]: lbl for lbl in dst_labels}
        mapping: dict[str, str] = {}

        for lbl in src_labels:
            if lbl["type"] == "system":
                if lbl["name"] in dst_by_name:
                    mapping[lbl["id"]] = dst_by_name[lbl["name"]]["id"]
                continue
            name = lbl["name"]
            if name in dst_by_name:
                mapping[lbl["id"]] = dst_by_name[name]["id"]
                continue
            body = {
                "name": name,
                "labelListVisibility": lbl.get("labelListVisibility", "labelShow"),
                "messageListVisibility": lbl.get("messageListVisibility", "show"),
            }
            try:
                created = self._create_label(self.dst, body)
                mapping[lbl["id"]] = created["id"]
                dst_by_name[name] = created
            except HttpError:
                pass

        self.progress.set_label_map(mapping)
        return mapping

    def _build_query(self) -> str:
        parts = []
        if self.skip_spam:
            parts.append("-in:spam")
        if self.skip_trash:
            parts.append("-in:trash")
        return " ".join(parts)

    def _iter_message_ids(self) -> Iterator[str]:
        q = self._build_query()
        page_token = None
        while True:
            resp = self._list_messages(q, page_token)
            for m in resp.get("messages", []):
                yield m["id"]
            page_token = resp.get("nextPageToken")
            if not page_token:
                break

    @retry_api
    def _list_messages(self, q, page_token):
        return (
            self.src.users().messages()
            .list(userId="me", q=q, pageToken=page_token, maxResults=500, includeSpamTrash=False)
            .execute()
        )

    @retry_api
    def _get_raw(self, msg_id):
        return self.src.users().messages().get(userId="me", id=msg_id, format="raw").execute()

    @retry_api
    def _insert_message(self, raw_b64, label_ids):
        body = {"raw": raw_b64, "labelIds": label_ids}
        return (
            self.dst.users().messages()
            .insert(userId="me", body=body, internalDateSource="dateHeader", deleted=False)
            .execute()
        )

    def _map_labels(self, src_label_ids, label_map):
        out = []
        for lid in src_label_ids:
            if lid in label_map:
                out.append(label_map[lid])
            elif lid in PRESERVED_SYSTEM_LABELS:
                out.append(lid)
        return [l for l in out if l not in ("SPAM", "TRASH")]

    def run(self) -> dict:
        label_map = self.sync_labels()
        total = migrated = skipped = failed = 0

        for msg_id in self._iter_message_ids():
            total += 1
            if self.progress.is_done(msg_id):
                skipped += 1
                self._report(total, migrated, skipped, failed, "")
                continue

            try:
                full = self._get_raw(msg_id)
                raw = full.get("raw")
                if not raw:
                    raise RetryableError("ingen raw payload")

                target_labels = self._map_labels(full.get("labelIds", []), label_map)
                result = self._insert_message(raw, target_labels)
                self.progress.mark_done(msg_id, {"target_id": result.get("id")})
                migrated += 1

                if migrated % 25 == 0:
                    self._report(total, migrated, skipped, failed, f"Migreret {migrated} emails")
                    time.sleep(0.5)

            except HttpError as e:
                failed += 1
                self.progress.mark_failed(msg_id, f"HTTP {e.resp.status}: {e}")
                self._report(total, migrated, skipped, failed, f"Fejl: {msg_id}")
            except Exception as e:
                failed += 1
                self.progress.mark_failed(msg_id, str(e))
                self._report(total, migrated, skipped, failed, f"Fejl: {e}")

        self._report(total, migrated, skipped, failed, f"Færdig. {migrated} migreret, {failed} fejlede")
        return {"total": total, "migrated": migrated, "skipped": skipped, "failed": failed}
