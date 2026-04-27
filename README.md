# Workspace Migrator

Hosted web tool for migrating Google Workspace data (Gmail, Drive, Calendar, Contacts) between two Workspace accounts.

## Deploy to Hostinger VPS

### 1. Create the VPS

In the Hostinger panel, create a VPS with **Ubuntu 22.04 or 24.04**. Note the IP address.

### 2. Point your domain at the VPS

In your DNS settings (Hostinger or wherever your domain lives), add an A record:

```
migrate.your-domain.com  →  <VPS IP>
```

Wait for DNS to propagate (usually a few minutes on Hostinger).

### 3. Install Docker on the VPS

SSH into the server and run:

```bash
curl -fsSL https://get.docker.com | sh
```

### 4. Clone the repo and configure

```bash
git clone https://github.com/MichaelSGad/workspace-migrator.git
cd workspace-migrator

cp .env.example .env
nano .env   # fill in the three values
```

The `.env` file:
```
SECRET_KEY=<generate with: openssl rand -hex 32>
POSTGRES_PASSWORD=<choose a strong password>
DOMAIN=migrate.your-domain.com
```

### 5. Start

```bash
docker compose up --build -d
```

Caddy automatically gets a Let's Encrypt certificate for your domain. The app will be live at `https://migrate.your-domain.com` within a minute.

### Updates

```bash
git pull && docker compose up --build -d
```

---

## Google service account setup

Each Workspace needs a service account with domain-wide delegation.

**Source Workspace scopes (read-only):**
```
https://www.googleapis.com/auth/gmail.readonly
https://www.googleapis.com/auth/drive.readonly
https://www.googleapis.com/auth/calendar.readonly
https://www.googleapis.com/auth/contacts.readonly
```

**Target Workspace scopes (write):**
```
https://www.googleapis.com/auth/gmail.insert
https://www.googleapis.com/auth/gmail.labels
https://www.googleapis.com/auth/gmail.modify
https://www.googleapis.com/auth/drive
https://www.googleapis.com/auth/calendar
https://www.googleapis.com/auth/contacts
```

---

## Architecture

- **Backend**: FastAPI + PostgreSQL + ThreadPoolExecutor (16 workers)
- **Frontend**: React + Vite + Tailwind CSS (built inside Docker)
- **Infra**: Docker Compose — `app` (FastAPI), `db` (Postgres 16), `nginx` (static + internal proxy), `caddy` (HTTPS termination)
- **Migration**: Gmail, Drive, Calendar, Contacts via Google APIs with resume logic and exponential backoff

## Local development

```bash
# Backend (needs a running Postgres)
cd backend && pip install -r requirements.txt
DATABASE_URL=postgresql://... uvicorn app.main:app --reload

# Frontend
cd frontend && npm install && npm run dev
```
