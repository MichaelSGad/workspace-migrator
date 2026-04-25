from google.oauth2 import service_account
from googleapiclient.discovery import build

GMAIL_SOURCE_SCOPES = ["https://www.googleapis.com/auth/gmail.readonly"]
GMAIL_TARGET_SCOPES = [
    "https://www.googleapis.com/auth/gmail.insert",
    "https://www.googleapis.com/auth/gmail.labels",
    "https://www.googleapis.com/auth/gmail.modify",
]
DRIVE_SOURCE_SCOPES = ["https://www.googleapis.com/auth/drive.readonly"]
DRIVE_TARGET_SCOPES = ["https://www.googleapis.com/auth/drive"]
CALENDAR_SOURCE_SCOPES = ["https://www.googleapis.com/auth/calendar.readonly"]
CALENDAR_TARGET_SCOPES = ["https://www.googleapis.com/auth/calendar"]
CONTACTS_SOURCE_SCOPES = ["https://www.googleapis.com/auth/contacts.readonly"]
CONTACTS_TARGET_SCOPES = ["https://www.googleapis.com/auth/contacts"]


def build_service(api: str, version: str, sa_file: str, user_email: str, scopes: list[str]):
    creds = service_account.Credentials.from_service_account_file(sa_file, scopes=scopes)
    delegated = creds.with_subject(user_email)
    return build(api, version, credentials=delegated, cache_discovery=False)
