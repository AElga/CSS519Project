# Docker Setup

The root `docker-compose.yml` now brings up the application and the observability stack together:

- `backend`: Node.js + Express API on port `3000`
- `frontend`: Nginx UI on port `8080`
- `traffic-simulator`: generates steady API, DB, log, and UI telemetry
- `prometheus`: metrics store on port `9090`
- `grafana`: dashboards on port `3002`
- `loki`: log store on port `3100`
- `promtail`: ships structured backend logs into Loki
- `cadvisor`: Docker container metrics on port `8081`
- `blackbox-exporter`: frontend/backend uptime probes on port `9115`
- `uptime-kuma`: additional uptime dashboard on port `3001`

The Docker stack now also injects the backend security settings needed by the updated compliance controls:

- `JWT_SECRET` is set for the backend container so signed sessions work inside Compose.
- `ALLOWED_ORIGINS` is set to the published frontend URLs on `localhost:8080` and `127.0.0.1:8080`.
- `traffic-simulator` authenticates before reading or creating appointments, so observability traffic still works with the protected routes.

## Start the stack

```bash
docker compose up --build
```

## Dashboard URLs

- App UI: `http://localhost:8080`
- Backend health: `http://localhost:3000/health`
- Prometheus: `http://localhost:9090`
- Grafana: `http://localhost:3002`
- Uptime Kuma: `http://localhost:3001`
- cAdvisor: `http://localhost:8081`

Grafana default credentials:

- Username: `adminElgHealth`
- Password: `SecurePasswordElg123`

The preprovisioned Grafana dashboard is `ElgHealth Observability`.

## What updates live

The simulator starts automatically and continuously triggers:

- successful and failed login attempts
- appointment creation and appointment reads
- frontend reachability checks
- UI interaction telemetry
- backend summary and metrics scrapes

That means the dashboards update live with API traffic, DB operations, audit/app logs, and container metrics without needing manual clicks.

## Stop the stack

```bash
docker compose down
```

## Reset persistent data

The application database and observability stores use named Docker volumes. To reset everything:

```bash
docker compose down -v
docker compose up --build
```

## Refresh seeded application data

The backend SQLite data is stored in the named `sqlite_data` volume, so it remains available even while containers are offline or stopped with `docker compose down`.

If you want to reset only the application database back to the seeded mock data:

```bash
docker compose down
docker volume rm css519project_sqlite_data
docker compose up --build
```

Mock account credentials are listed in `Project/mock-accounts.txt`.
