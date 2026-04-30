import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from ..config import settings


def send_job_notification(to_email: str, job_status: str, project_name: str, job_id: str):
    if not settings.smtp_host or not settings.smtp_user:
        return

    status_da = "fuldført" if job_status == "done" else "fejlede"
    icon = "✅" if job_status == "done" else "❌"
    subject = f"{icon} Migration {status_da} — {project_name}"
    body = (
        f"Din migration af \"{project_name}\" er {status_da}.\n\n"
        f"Se detaljer og log her:\n{settings.app_url}/jobs/{job_id}"
    )

    msg = MIMEMultipart()
    msg["From"] = settings.smtp_from or settings.smtp_user
    msg["To"] = to_email
    msg["Subject"] = subject
    msg.attach(MIMEText(body, "plain", "utf-8"))

    try:
        with smtplib.SMTP(settings.smtp_host, settings.smtp_port) as server:
            if settings.smtp_tls:
                server.starttls()
            if settings.smtp_password:
                server.login(settings.smtp_user, settings.smtp_password)
            server.send_message(msg)
    except Exception:
        pass  # email failure must never break a migration
