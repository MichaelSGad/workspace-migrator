from datetime import datetime
from typing import Optional
from pydantic import BaseModel

from .models import JobStatus, ServiceStatus


# Auth
class LoginRequest(BaseModel):
    email: str
    password: str


class SetupRequest(BaseModel):
    email: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserOut(BaseModel):
    id: int
    email: str
    is_admin: bool

    class Config:
        from_attributes = True


# Projects
class ProjectUserIn(BaseModel):
    source_email: str
    target_email: str


class ProjectUserOut(BaseModel):
    id: int
    source_email: str
    target_email: str

    class Config:
        from_attributes = True


class JobBasicOut(BaseModel):
    id: str
    status: JobStatus
    created_at: datetime

    class Config:
        from_attributes = True


class ProjectOut(BaseModel):
    id: int
    name: str
    source_domain: str
    target_domain: str
    created_at: datetime
    user_pairs: list[ProjectUserOut] = []
    jobs: list[JobBasicOut] = []

    class Config:
        from_attributes = True


# Jobs
class StartJobRequest(BaseModel):
    services: list[str]


class DiagnoseRequest(BaseModel):
    log: str
    service: str
    source_email: str = ""
    target_email: str = ""


class JobProgressOut(BaseModel):
    id: int
    source_email: str
    target_email: str
    service: str
    status: ServiceStatus
    total: int
    migrated: int
    skipped: int
    failed_count: int
    log_tail: str
    updated_at: datetime

    class Config:
        from_attributes = True


class JobOut(BaseModel):
    id: str
    project_id: int
    status: JobStatus
    services: list[str]
    created_at: datetime
    started_at: Optional[datetime]
    finished_at: Optional[datetime]
    progress: list[JobProgressOut] = []

    class Config:
        from_attributes = True
