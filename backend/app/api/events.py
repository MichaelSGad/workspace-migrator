import asyncio
import json
from typing import Optional

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import StreamingResponse
from jose import JWTError, jwt
from sqlalchemy.orm import Session

from ..config import settings
from ..database import SessionLocal
from ..models import MigrationJob, User

router = APIRouter(tags=["events"])


def _get_user_from_token(token: str, db: Session) -> User:
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
        user_id = int(payload["sub"])
    except (JWTError, KeyError, ValueError):
        raise HTTPException(status_code=401, detail="Ugyldig token")
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=401, detail="Bruger ikke fundet")
    return user


@router.get("/api/jobs/{job_id}/stream")
async def stream_job(job_id: str, token: Optional[str] = Query(default=None)):
    async def event_generator():
        while True:
            db: Session = SessionLocal()
            try:
                user = _get_user_from_token(token or "", db)
                job = db.get(MigrationJob, job_id)
                if not job or job.project.owner_id != user.id:
                    yield f"data: {json.dumps({'error': 'ikke fundet'})}\n\n"
                    return

                progress_data = [
                    {
                        "id": p.id,
                        "source_email": p.source_email,
                        "target_email": p.target_email,
                        "service": p.service,
                        "status": p.status.value,
                        "total": p.total,
                        "migrated": p.migrated,
                        "skipped": p.skipped,
                        "failed_count": p.failed_count,
                        "log_tail": p.log_tail,
                    }
                    for p in job.progress
                ]

                payload = {
                    "job_id": job_id,
                    "status": job.status.value,
                    "progress": progress_data,
                }
                yield f"data: {json.dumps(payload)}\n\n"

                if job.status.value in ("done", "failed", "cancelled"):
                    return
            finally:
                db.close()

            await asyncio.sleep(1)

    return StreamingResponse(event_generator(), media_type="text/event-stream")
