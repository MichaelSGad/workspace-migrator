# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Running the app
```bash
cp .env.example .env           # set SECRET_KEY to a long random string
cd frontend && npm install && npm run build && cd ..
docker-compose up --build      # app at http://localhost, API at http://localhost/api
```

### Frontend
```bash
cd frontend
npm run dev       # Vite dev server (hot reload)
npm run build     # production build to dist/
npm run preview   # preview built output
```

### Backend
The backend runs inside Docker via `uvicorn app.main:app --host 0.0.0.0 --port 8000`. To run it locally:
```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload   # needs DATABASE_URL pointing at a running Postgres
```

## Architecture

This is a **Google Workspace-to-Workspace migration tool**: it copies Gmail, Drive, Calendar, and Contacts from one Google Workspace account to another using service accounts with domain-wide delegation.

### Stack
- **Backend**: FastAPI + SQLAlchemy (PostgreSQL) + Uvicorn
- **Frontend**: React 18 + React Router + Tailwind CSS + Vite
- **Infrastructure**: Docker Compose (Postgres 16, FastAPI app, Nginx reverse proxy)
- **Nginx**: `/api/*` → `localhost:8000`, everything else → built React static files (port 80)

### Migration execution flow
1. User creates a **Project** → uploads source and target Google service account JSON keys
2. User defines **user pairs** (source email → target email)
3. User starts a **Job** and selects services (gmail/drive/calendar/contacts)
4. `backend/app/services/job_runner.py` runs migrations in a `ThreadPoolExecutor` (16 workers max), one task per (user × service) combination
5. Each service has a dedicated migrator class in `backend/app/migration/` inheriting from `BaseMigrator`
6. Progress is persisted in both the DB (`JobUserProgress`) and JSON files under `/data/progress/` for resumability
7. Frontend streams live progress via SSE at `GET /api/jobs/{id}/stream`

### Key backend files
| File | Purpose |
|------|---------|
| `app/main.py` | FastAPI app setup, CORS, route registration |
| `app/models.py` | SQLAlchemy ORM: `User`, `Project`, `ProjectUser`, `MigrationJob`, `JobUserProgress` |
| `app/schemas.py` | Pydantic request/response models |
| `app/config.py` | Settings loaded from `.env`: `SECRET_KEY`, `DATABASE_URL`, `SA_KEYS_DIR`, `PROGRESS_DIR` |
| `app/api/events.py` | SSE endpoint that streams `JobUserProgress` updates |
| `app/services/job_runner.py` | ThreadPoolExecutor orchestrator; updates DB progress after each migrator callback |
| `app/migration/auth.py` | Google API credential setup; builds service objects for each Google API |
| `app/migration/base.py` | `BaseMigrator` abstract class; all service migrators extend this |

### Key frontend files
| File | Purpose |
|------|---------|
| `src/api/client.js` | Fetch wrapper, JWT token management, all API methods |
| `src/App.jsx` | React Router: `/login`, `/`, `/projects/:id`, `/jobs/:id` |
| `src/pages/NewProject.jsx` | Multi-step wizard: name → domains → SA key upload → user pairs → services |
| `src/pages/JobProgress.jsx` | Consumes SSE stream, renders per-user/per-service live status |

### Data persistence
- **PostgreSQL**: project metadata, user pairs, job records, per-user progress rows
- **`/data/sa_keys/`**: uploaded service account JSON files (Docker volume)
- **`/data/progress/`**: JSON progress snapshots for resume-on-restart
- **`/data/logs/`**: per-job log files

### Error handling conventions
- Google API calls use `tenacity` for exponential backoff on rate-limit (429) and transient errors
- Failed user migrations update `JobUserProgress.status = "failed"` without aborting the whole job
- JWT tokens expire after 24 hours (`ACCESS_TOKEN_EXPIRE_MINUTES = 1440`)
