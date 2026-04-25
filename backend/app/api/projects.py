import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session

from ..api.auth import get_current_user
from ..config import settings
from ..database import get_db
from ..models import Project, ProjectUser, User
from ..schemas import ProjectOut, ProjectUserIn, ProjectUserOut

router = APIRouter(prefix="/api/projects", tags=["projects"])


def _save_sa_key(file: UploadFile) -> str:
    Path(settings.sa_keys_dir).mkdir(parents=True, exist_ok=True)
    filename = f"{uuid.uuid4()}.json"
    path = Path(settings.sa_keys_dir) / filename
    path.write_bytes(file.file.read())
    return str(path)


@router.get("", response_model=list[ProjectOut])
def list_projects(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return db.query(Project).filter(Project.owner_id == current_user.id).all()


@router.post("", response_model=ProjectOut)
def create_project(
    name: str = Form(...),
    source_domain: str = Form(...),
    target_domain: str = Form(...),
    source_sa_key: UploadFile = File(...),
    target_sa_key: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    source_path = _save_sa_key(source_sa_key)
    target_path = _save_sa_key(target_sa_key)

    project = Project(
        name=name,
        owner_id=current_user.id,
        source_domain=source_domain,
        target_domain=target_domain,
        source_sa_path=source_path,
        target_sa_path=target_path,
    )
    db.add(project)
    db.commit()
    db.refresh(project)
    return project


@router.get("/{project_id}", response_model=ProjectOut)
def get_project(project_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    project = db.query(Project).filter(Project.id == project_id, Project.owner_id == current_user.id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Projekt ikke fundet")
    return project


@router.delete("/{project_id}", status_code=204)
def delete_project(project_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    project = db.query(Project).filter(Project.id == project_id, Project.owner_id == current_user.id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Projekt ikke fundet")
    db.delete(project)
    db.commit()


@router.post("/{project_id}/users", response_model=ProjectUserOut)
def add_user(
    project_id: int,
    pair: ProjectUserIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project = db.query(Project).filter(Project.id == project_id, Project.owner_id == current_user.id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Projekt ikke fundet")
    user_pair = ProjectUser(project_id=project_id, source_email=pair.source_email, target_email=pair.target_email)
    db.add(user_pair)
    db.commit()
    db.refresh(user_pair)
    return user_pair


@router.delete("/{project_id}/users/{user_id}", status_code=204)
def remove_user(
    project_id: int,
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project = db.query(Project).filter(Project.id == project_id, Project.owner_id == current_user.id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Projekt ikke fundet")
    pair = db.query(ProjectUser).filter(ProjectUser.id == user_id, ProjectUser.project_id == project_id).first()
    if not pair:
        raise HTTPException(status_code=404, detail="Bruger ikke fundet")
    db.delete(pair)
    db.commit()
