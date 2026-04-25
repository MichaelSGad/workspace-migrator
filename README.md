# Workspace Migrator

Hosted web-produkt til migration af Google Workspace-data (Gmail, Drive, Kalender, Kontakter) mellem to Workspace-konti.

## Kom i gang

```bash
cp .env.example .env
# Rediger .env og sæt SECRET_KEY til en lang tilfældig streng

cd frontend && npm install && npm run build && cd ..
docker-compose up --build
```

Åbn http://localhost — opret admin-konto ved første besøg.

## Opsætning af Google service accounts

Se `vindroserejser/README.md` for detaljer om domain-wide delegation og hvilke scopes der kræves.

## Arkitektur

- **Backend**: FastAPI + PostgreSQL + ThreadPoolExecutor
- **Frontend**: React + Vite + Tailwind CSS
- **Infra**: Docker Compose (app + db + nginx)
- **Migration**: Gmail, Drive, Kalender, Kontakter via Google APIs med resume-logik
