import time

from googleapiclient.errors import HttpError
from tenacity import retry, retry_if_exception_type, stop_after_attempt, wait_exponential

from .auth import CALENDAR_SOURCE_SCOPES, CALENDAR_TARGET_SCOPES, build_service
from .base import BaseMigrator, ProgressCallback
from .progress import Progress

retry_api = retry(
    reraise=True,
    stop=stop_after_attempt(5),
    wait=wait_exponential(multiplier=2, min=2, max=60),
    retry=retry_if_exception_type(HttpError),
)

SKIP_CALENDAR_IDS = {"contacts@group.v.calendar.google.com", "en.danish#holiday@group.v.calendar.google.com"}


class CalendarMigrator(BaseMigrator):
    def __init__(self, source_user, target_user, source_sa, target_sa, progress_dir,
                 on_progress: ProgressCallback | None = None):
        super().__init__(source_user, target_user, source_sa, target_sa, progress_dir, on_progress)
        progress_path = f"{progress_dir}/calendar_{source_user}.json"
        self.progress = Progress(progress_path)
        self.src = build_service("calendar", "v3", source_sa, source_user, CALENDAR_SOURCE_SCOPES)
        self.dst = build_service("calendar", "v3", target_sa, target_user, CALENDAR_TARGET_SCOPES)

    @retry_api
    def _list_calendars(self):
        return self.src.calendarList().list().execute().get("items", [])

    @retry_api
    def _list_events(self, cal_id, page_token=None):
        return self.src.events().list(
            calendarId=cal_id,
            pageToken=page_token,
            maxResults=250,
            singleEvents=False,
        ).execute()

    @retry_api
    def _create_calendar(self, summary):
        return self.dst.calendars().insert(body={"summary": summary}).execute()

    @retry_api
    def _insert_event(self, cal_id, event_body):
        clean = {k: v for k, v in event_body.items()
                 if k not in ("id", "etag", "htmlLink", "created", "updated", "creator", "organizer")}
        return self.dst.events().insert(calendarId=cal_id, body=clean).execute()

    def _migrate_calendar(self, src_cal_id, dst_cal_id, total_ref, migrated_ref, skipped_ref, failed_ref):
        page_token = None
        while True:
            resp = self._list_events(src_cal_id, page_token)
            for event in resp.get("items", []):
                total_ref[0] += 1
                ical_uid = event.get("iCalUID", event["id"])
                done_key = f"{src_cal_id}:{ical_uid}"

                if self.progress.is_done(done_key):
                    skipped_ref[0] += 1
                    continue

                try:
                    self._insert_event(dst_cal_id, event)
                    self.progress.mark_done(done_key)
                    migrated_ref[0] += 1

                    if migrated_ref[0] % 50 == 0:
                        self._report(
                            total_ref[0], migrated_ref[0], skipped_ref[0], failed_ref[0],
                            f"Migreret {migrated_ref[0]} kalenderbegivenheder"
                        )
                        time.sleep(0.3)

                except HttpError as e:
                    failed_ref[0] += 1
                    self.progress.mark_failed(done_key, str(e))
                    self._report(total_ref[0], migrated_ref[0], skipped_ref[0], failed_ref[0],
                                 f"Fejl ved event: {e.resp.status}")

            page_token = resp.get("nextPageToken")
            if not page_token:
                break

    def run(self) -> dict:
        calendars = self._list_calendars()
        total = [0]
        migrated = [0]
        skipped = [0]
        failed = [0]

        for cal in calendars:
            cal_id = cal["id"]
            summary = cal.get("summary", cal_id)

            if cal_id in SKIP_CALENDAR_IDS:
                continue

            if cal.get("primary"):
                dst_cal_id = "primary"
            else:
                try:
                    created = self._create_calendar(summary)
                    dst_cal_id = created["id"]
                except HttpError:
                    continue

            self._report(total[0], migrated[0], skipped[0], failed[0], f"Migrerer kalender: {summary}")
            self._migrate_calendar(cal_id, dst_cal_id, total, migrated, skipped, failed)

        self._report(total[0], migrated[0], skipped[0], failed[0],
                     f"Kalender færdig. {migrated[0]} migreret, {failed[0]} fejlede")
        return {"total": total[0], "migrated": migrated[0], "skipped": skipped[0], "failed": failed[0]}
