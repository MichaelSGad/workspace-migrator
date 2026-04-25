import time

from googleapiclient.errors import HttpError
from tenacity import retry, retry_if_exception_type, stop_after_attempt, wait_exponential

from .auth import CONTACTS_SOURCE_SCOPES, CONTACTS_TARGET_SCOPES, build_service
from .base import BaseMigrator, ProgressCallback
from .progress import Progress

PERSON_FIELDS = (
    "names,emailAddresses,phoneNumbers,addresses,organizations,"
    "birthdays,biographies,urls,userDefined,nicknames,relations"
)

retry_api = retry(
    reraise=True,
    stop=stop_after_attempt(5),
    wait=wait_exponential(multiplier=2, min=2, max=60),
    retry=retry_if_exception_type(HttpError),
)


class ContactsMigrator(BaseMigrator):
    def __init__(self, source_user, target_user, source_sa, target_sa, progress_dir,
                 on_progress: ProgressCallback | None = None):
        super().__init__(source_user, target_user, source_sa, target_sa, progress_dir, on_progress)
        progress_path = f"{progress_dir}/contacts_{source_user}.json"
        self.progress = Progress(progress_path)
        self.src = build_service("people", "v1", source_sa, source_user, CONTACTS_SOURCE_SCOPES)
        self.dst = build_service("people", "v1", target_sa, target_user, CONTACTS_TARGET_SCOPES)

    @retry_api
    def _list_contacts(self, page_token=None):
        return self.src.people().connections().list(
            resourceName="people/me",
            pageToken=page_token,
            pageSize=200,
            personFields=PERSON_FIELDS,
        ).execute()

    @retry_api
    def _create_contact(self, body):
        return self.dst.people().createContact(body=body).execute()

    def _clean_person(self, person: dict) -> dict:
        skip_keys = {"resourceName", "etag", "metadata"}
        return {k: v for k, v in person.items() if k not in skip_keys}

    def run(self) -> dict:
        total = migrated = skipped = failed = 0
        page_token = None

        while True:
            resp = self._list_contacts(page_token)
            contacts = resp.get("connections", [])

            for person in contacts:
                total += 1
                resource_name = person.get("resourceName", "")

                if self.progress.is_done(resource_name):
                    skipped += 1
                    continue

                try:
                    body = self._clean_person(person)
                    self._create_contact(body)
                    self.progress.mark_done(resource_name)
                    migrated += 1

                    if migrated % 50 == 0:
                        self._report(total, migrated, skipped, failed,
                                     f"Migreret {migrated} kontakter")
                        time.sleep(0.5)

                except HttpError as e:
                    failed += 1
                    self.progress.mark_failed(resource_name, str(e))
                    self._report(total, migrated, skipped, failed,
                                 f"Fejl ved kontakt: {e.resp.status}")

            page_token = resp.get("nextPageToken")
            if not page_token:
                break

        self._report(total, migrated, skipped, failed,
                     f"Kontakter færdig. {migrated} migreret, {failed} fejlede")
        return {"total": total, "migrated": migrated, "skipped": skipped, "failed": failed}
