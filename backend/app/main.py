from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from .api import auth, projects, jobs, events
from .database import create_tables, SessionLocal

app = FastAPI(title="Workspace Migrator")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(projects.router)
app.include_router(jobs.router)
app.include_router(events.router)


@app.on_event("startup")
def startup():
    create_tables()
    # Mark jobs that were running when the server last stopped so users
    # know to restart them (progress files on disk are preserved for resume).
    from .services.job_runner import recover_stale_jobs
    recover_stale_jobs(SessionLocal)


frontend_dir = Path(__file__).parent.parent.parent / "frontend" / "dist"
if frontend_dir.exists():
    app.mount("/", StaticFiles(directory=str(frontend_dir), html=True), name="frontend")
