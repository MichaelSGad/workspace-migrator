import enum
from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, Enum, ForeignKey, Integer, JSON, String, Text
from sqlalchemy.orm import relationship

from .database import Base


class JobStatus(str, enum.Enum):
    pending = "pending"
    running = "running"
    done = "done"
    failed = "failed"
    cancelled = "cancelled"


class ServiceStatus(str, enum.Enum):
    pending = "pending"
    running = "running"
    done = "done"
    failed = "failed"


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True)
    email = Column(String, unique=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    is_admin = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    projects = relationship("Project", back_populates="owner")


class Project(Base):
    __tablename__ = "projects"

    id = Column(Integer, primary_key=True)
    name = Column(String, nullable=False)
    owner_id = Column(Integer, ForeignKey("users.id"))
    source_domain = Column(String, nullable=False)
    target_domain = Column(String, nullable=False)
    source_sa_path = Column(String, nullable=False)
    target_sa_path = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    owner = relationship("User", back_populates="projects")
    user_pairs = relationship("ProjectUser", back_populates="project", cascade="all, delete-orphan")
    jobs = relationship("MigrationJob", back_populates="project", cascade="all, delete-orphan")


class ProjectUser(Base):
    __tablename__ = "project_users"

    id = Column(Integer, primary_key=True)
    project_id = Column(Integer, ForeignKey("projects.id"))
    source_email = Column(String, nullable=False)
    target_email = Column(String, nullable=False)

    project = relationship("Project", back_populates="user_pairs")


class MigrationJob(Base):
    __tablename__ = "migration_jobs"

    id = Column(String, primary_key=True)
    project_id = Column(Integer, ForeignKey("projects.id"))
    status = Column(Enum(JobStatus), default=JobStatus.pending)
    services = Column(JSON, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    started_at = Column(DateTime, nullable=True)
    finished_at = Column(DateTime, nullable=True)

    project = relationship("Project", back_populates="jobs")
    progress = relationship("JobUserProgress", back_populates="job", cascade="all, delete-orphan")


class JobUserProgress(Base):
    __tablename__ = "job_user_progress"

    id = Column(Integer, primary_key=True)
    job_id = Column(String, ForeignKey("migration_jobs.id"))
    source_email = Column(String, nullable=False)
    target_email = Column(String, nullable=False)
    service = Column(String, nullable=False)
    status = Column(Enum(ServiceStatus), default=ServiceStatus.pending)
    total = Column(Integer, default=0)
    migrated = Column(Integer, default=0)
    skipped = Column(Integer, default=0)
    failed_count = Column(Integer, default=0)
    log_tail = Column(Text, default="")
    updated_at = Column(DateTime, default=datetime.utcnow)

    job = relationship("MigrationJob", back_populates="progress")
