from concurrent.futures import ThreadPoolExecutor, as_completed

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..api.auth import get_current_user
from ..config import settings
from ..database import get_db, SessionLocal
from ..models import MigrationJob, JobStatus, Project, User
from ..schemas import JobOut, StartJobRequest, DiagnoseRequest
from ..services.job_runner import start_job, cancel_job
from ..migration.gmail import GmailMigrator
from ..migration.drive import DriveMigrator
from ..migration.calendar import CalendarMigrator
from ..migration.contacts import ContactsMigrator

router = APIRouter(tags=["jobs"])

MIGRATOR_MAP = {
    "gmail": GmailMigrator,
    "drive": DriveMigrator,
    "calendar": CalendarMigrator,
    "contacts": ContactsMigrator,
}


def _db_factory():
    return SessionLocal()


@router.post("/api/projects/{project_id}/jobs", response_model=JobOut)
def create_job(
    project_id: int,
    req: StartJobRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project = db.query(Project).filter(Project.id == project_id, Project.owner_id == current_user.id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Projekt ikke fundet")
    if not project.user_pairs:
        raise HTTPException(status_code=400, detail="Ingen brugere tilføjet til projektet")
    valid = {"gmail", "drive", "calendar", "contacts"}
    services = [s for s in req.services if s in valid]
    if not services:
        raise HTTPException(status_code=400, detail="Ingen gyldige services valgt")

    running = db.query(MigrationJob).filter(MigrationJob.status == JobStatus.running).count()
    if running >= settings.max_concurrent_jobs:
        raise HTTPException(
            status_code=429,
            detail=f"Serveren kører allerede {running} job(s). Vent til et job er færdigt og prøv igen."
        )

    job = start_job(db, _db_factory, project, services)
    return job


@router.get("/api/projects/{project_id}/jobs", response_model=list[JobOut])
def list_jobs(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project = db.query(Project).filter(Project.id == project_id, Project.owner_id == current_user.id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Projekt ikke fundet")
    return project.jobs


@router.get("/api/jobs/{job_id}", response_model=JobOut)
def get_job(
    job_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    job = db.get(MigrationJob, job_id)
    if not job or job.project.owner_id != current_user.id:
        raise HTTPException(status_code=404, detail="Job ikke fundet")
    return job


@router.post("/api/jobs/{job_id}/stop", status_code=202)
def stop_job(
    job_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    job = db.get(MigrationJob, job_id)
    if not job or job.project.owner_id != current_user.id:
        raise HTTPException(status_code=404, detail="Job ikke fundet")
    if job.status == JobStatus.running:
        cancel_job(job_id)  # signals all threads to stop gracefully
        job.status = JobStatus.cancelled
        db.commit()
    return {"status": "stop anmodet"}


@router.post("/api/jobs/{job_id}/verify")
def verify_job(
    job_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Run a count comparison (source vs target) for each service in the job.
    Runs in parallel across services. May take a minute for large mailboxes."""
    job = db.get(MigrationJob, job_id)
    if not job or job.project.owner_id != current_user.id:
        raise HTTPException(status_code=404, detail="Job ikke fundet")
    if job.status == JobStatus.running:
        raise HTTPException(status_code=400, detail="Job kører stadig — vent til det er færdigt")

    project = job.project

    def _run_verify(user_pair, service):
        migrator_cls = MIGRATOR_MAP.get(service)
        if not migrator_cls:
            return None
        migrator = migrator_cls(
            source_user=user_pair.source_email,
            target_user=user_pair.target_email,
            source_sa=project.source_sa_path,
            target_sa=project.target_sa_path,
            progress_dir=settings.progress_dir,
        )
        result = migrator.verify()
        result["source_user"] = user_pair.source_email
        result["target_user"] = user_pair.target_email
        return result

    results = []
    with ThreadPoolExecutor(max_workers=8) as pool:
        futures = {
            pool.submit(_run_verify, pair, service): (pair.source_email, service)
            for pair in project.user_pairs
            for service in job.services
        }
        for future in as_completed(futures):
            try:
                r = future.result()
                if r:
                    results.append(r)
            except Exception as e:
                src, svc = futures[future]
                results.append({
                    "source_user": src,
                    "service": svc,
                    "error": str(e),
                    "status": "fejl",
                })

    overall_ok = all(r.get("status") == "ok" for r in results if "error" not in r)
    return {"ok": overall_ok, "results": results}


@router.post("/api/diagnose")
def diagnose_error(
    req: DiagnoseRequest,
    current_user: User = Depends(get_current_user),
):
    """Use Claude Haiku to explain a migration error in plain Danish."""
    import json
    import os
    import anthropic

    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        raise HTTPException(status_code=503, detail="AI-analyse ikke konfigureret (mangler ANTHROPIC_API_KEY)")

    client = anthropic.Anthropic(api_key=api_key)

    service_labels = {"gmail": "Gmail", "drive": "Drive", "calendar": "Kalender", "contacts": "Kontakter"}
    service_name = service_labels.get(req.service, req.service)

    message = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=512,
        system=(
            "Du er en hjælpsom support-assistent for Google Workspace migreringer. "
            "Analyser fejlen fra migreringen og forklar det på enkel dansk uden teknisk jargon. "
            "Svar KUN med gyldig JSON i dette format:\n"
            '{"title": "...", "explanation": "...", "fix": "..."}\n'
            "- title: maks 8 ord der beskriver hvad gik galt\n"
            "- explanation: 2-3 sætninger der forklarer årsagen til ikke-teknikere\n"
            "- fix: konkret vejledning til hvad brugeren skal gøre nu"
        ),
        messages=[{
            "role": "user",
            "content": (
                f"Service: {service_name}\n"
                f"Kilde-bruger: {req.source_email}\n"
                f"Mål-bruger: {req.target_email}\n\n"
                f"Fejllog:\n{req.log[-2000:]}"
            ),
        }],
    )

    try:
        result = json.loads(message.content[0].text)
    except Exception:
        result = {
            "title": "Fejl ved analyse",
            "explanation": message.content[0].text,
            "fix": "Se fejlloggen for detaljer.",
        }

    return result
