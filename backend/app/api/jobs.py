from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..api.auth import get_current_user
from ..database import get_db, SessionLocal
from ..models import MigrationJob, JobStatus, Project, User
from ..schemas import JobOut, StartJobRequest
from ..services.job_runner import start_job

router = APIRouter(tags=["jobs"])


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
        job.status = JobStatus.cancelled
        db.commit()
    return {"status": "stop anmodet"}
