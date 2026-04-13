# Docker Setup

This project now includes a two-container Docker setup:

- `backend`: Node.js + Express API on port `3000`
- `frontend`: Nginx serving the static UI on port `8080`

## Start the app

```bash
docker compose up --build
```

## Open the app

- Frontend: `http://localhost:8080`
- Backend health check: `http://localhost:3000/health`

## Stop the app

```bash
docker compose down
```

## Reset the SQLite volume

The backend uses a named Docker volume called `sqlite_data`. To remove the stored database and recreate it from `backend/schema.sql` on next startup:

```bash
docker compose down -v
docker compose up --build
```
