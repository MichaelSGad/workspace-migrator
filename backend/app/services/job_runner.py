import threading
import uuid
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime

from sqlalchemy.orm import Session

from ..config import settings
from ..models import JobStatus, JobUserProgress, MigrationJob, ServiceStatus
from ..migration.gmail import GmailMigrator
from ..migration.drive import DriveMigrator
from ..migration.calendar import CalendarMigrator
from ..migration.contacts import ContactsMigrator

_executor = ThreadPoolExecutor(max_workers=16)

# job_id → threading.Event; set this to signal cancellation to running threads
_stop_events: dict[str, threading.Event] = {}
_stop_events_lock = threading.Lock()

MIGRATOR_MAP = {
    "gmail": GmailMigrator,
    "drive": DriveMigrator,
    "calendar": CalendarMigrator,
    "contacts": ContactsMigrator,
}


def cancel_job(job_id: str):
    """Signal all threads for this job to stop gracefully."""
    with _stop_events_lock:
        event = _stop_events.get(job_id)
    if event:
        event.set()


def recover_stale_jobs(db_factory):
    """On startup: mark any jobs that were running when the server last died.
    Progress files on disk are preserved, so users can restart to resume."""
    db: Session = db_factory()
    try:
        stale = db.query(MigrationJob).filter(MigrationJob.status == JobStatus.running).all()
        for job in stale:
            job.status = JobStatus.failed
            job.finished_at = datetime.utcnow()
            for p in job.progress:
                if p.status == ServiceStatus.running:
                    p.status = ServiceStatus.failed
                    p.log_tail = (p.log_tail or "") + (
                        "\nAfbrudt: serveren blev genstartet. "
                        "Start et nyt job for at genoptage — allerede migrerede elementer springes over."
                    )
                    p.updated_at = datetime.utcnow()
        if stale:
            db.commit()
    finally:
        db.close()


def _run_service(db_factory, job_id: str, progress_id: int,
                 source_user: str, target_user: str,
                 source_sa: str, target_sa: str, service: str,
                 stop_event: threading.Event):
    db: Session = db_factory()
    try:
        progress_row = db.get(JobUserProgress, progress_id)
        if not progress_row:
            return
        progress_row.status = ServiceStatus.running
        progress_row.updated_at = datetime.utcnow()
        db.commit()

        def on_progress(total, migrated, skipped, failed, log_line):
            inner_db: Session = db_factory()
            try:
                row = inner_db.get(JobUserProgress, progress_id)
                if row:
                    row.total = total
                    row.migrated = migrated
                    row.skipped = skipped
                    row.failed_count = failed
                    row.updated_at = datetime.utcnow()
                    if log_line:
                        lines = (row.log_tail or "").split("\n")
                        lines.append(log_line)
                        row.log_tail = "\n".join(lines[-100:])
                    inner_db.commit()
            finally:
                inner_db.close()

        migrator_cls = MIGRATOR_MAP[service]
        migrator = migrator_cls(
            source_user=source_user,
            target_user=target_user,
            source_sa=source_sa,
            target_sa=target_sa,
            progress_dir=settings.progress_dir,
            on_progress=on_progress,
            stop_event=stop_event,
        )
        result = migrator.run()

        progress_row = db.get(JobUserProgress, progress_id)
        if progress_row:
            final_status = ServiceStatus.done
            # If stop was requested, mark as failed so user knows it's incomplete
            if stop_event.is_set():
                final_status = ServiceStatus.failed
            progress_row.status = final_status
            progress_row.total = result.get("total", 0)
            progress_row.migrated = result.get("migrated", 0)
            progress_row.skipped = result.get("skipped", 0)
            progress_row.failed_count = result.get("failed", 0)
            progress_row.updated_at = datetime.utcnow()
            db.commit()

    except Exception as e:
        row = db.get(JobUserProgress, progress_id)
        if row:
            row.status = ServiceStatus.failed
            row.log_tail = (row.log_tail or "") + f"\nFATAL: {e}"
            row.updated_at = datetime.utcnow()
            db.commit()
    finally:
        db.close()
        _check_job_done(db_factory, job_id)


def _check_job_done(db_factory, job_id: str):
    db: Session = db_factory()
    try:
        job = db.get(MigrationJob, job_id)
        if not job:
            return
        all_progress = job.progress
        statuses = {p.status for p in all_progress}
        if statuses <= {ServiceStatus.done, ServiceStatus.failed}:
            job.status = (
                JobStatus.failed
                if all(p.status == ServiceStatus.failed for p in all_progress)
                else JobStatus.done
            )
            job.finished_at = datetime.utcnow()
            db.commit()
            # Clean up stop event once job is complete
            with _stop_events_lock:
                _stop_events.pop(job_id, None)
    finally:
        db.close()


def start_job(db: Session, db_factory, project, services: list[str]) -> MigrationJob:
    job_id = str(uuid.uuid4())
    stop_event = threading.Event()

    with _stop_events_lock:
        _stop_events[job_id] = stop_event

    job = MigrationJob(
        id=job_id,
        project_id=project.id,
        status=JobStatus.running,
        services=services,
        started_at=datetime.utcnow(),
    )
    db.add(job)
    db.flush()

    progress_rows = []
    for user_pair in project.user_pairs:
        for service in services:
            row = JobUserProgress(
                job_id=job_id,
                source_email=user_pair.source_email,
                target_email=user_pair.target_email,
                service=service,
                status=ServiceStatus.pending,
            )
            db.add(row)
            db.flush()
            progress_rows.append((row.id, user_pair.source_email, user_pair.target_email, service))

    db.commit()

    for row_id, src_email, tgt_email, service in progress_rows:
        _executor.submit(
            _run_service,
            db_factory, job_id, row_id,
            src_email, tgt_email,
            project.source_sa_path, project.target_sa_path,
            service,
            stop_event,
        )

    db.refresh(job)
    return job
