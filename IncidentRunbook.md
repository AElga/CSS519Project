Note to professor: This runbook was generated based on the simulated incident that was setup. While most of the structure and instructions was initialy written by Github Copilot, I did review and edit some parts.

# Incident Runbook: Docker Container Stopped

## Overview

This runbook addresses the incident of a randomly stopped Docker container in the ElgHealth observability stack. The `stop_random_container.ps1` (PowerShell) script simulates a container failure by stopping one of the six core services: `uptime-kuma`, `backend`, `cadvisor`, `prometheus`, `frontend`, or `grafana`.

---

## Affected Services

The following services can be affected by this incident:

- **uptime-kuma** — Uptime monitoring dashboard on port 3001
- **backend** — ElgHealth API on port 3000
- **cadvisor** — Docker container metrics exporter on port 8081
- **prometheus** — Time-series metrics database on port 9090
- **frontend** — ElgHealth web UI (Nginx) on port 8080
- **grafana** — Observability dashboards on port 3002

---

## Detection

### Monitoring Status in Kuma

1. Open **Uptime Kuma** at `http://localhost:3001`
2. View the Dashboard for one of the following
   - **Backend Online** — UP (Green), DOWN (Red)
   - **Frontend Online** — UP (Green), DOWN (Red)
   - **Grafana Online** — UP (Green), DOWN (Red)
   - **Prometheus Online** — UP (Green), DOWN (Red)
   - **cAdvisor Online** — UP (Green), DOWN (Red)
   
### Alert Firing in Prometheus

When a container is stopped, its corresponding alert fires within **10 seconds**. Check the Prometheus alerts page:

1. Open **Prometheus** at `http://localhost:9090`
2. Navigate to the **Alerts** tab
3. Look for one of these alerts in state `FIRING`:
   - `PrometheusDown` — Prometheus service is down
   - `GrafanaDown` — Grafana service is down
   - `UptimeKumaDown` — Uptime Kuma service is down
   - `CadvisorDown` — cAdvisor service is down
   - `ElgHealthBackendDown` — Backend service is down
   - `ElgHealthFrontendDown` — Frontend service is down

### Visual Indication in Grafana Dashboard

1. Open **Grafana** at `http://localhost:3002`
2. Navigate to the **ElgHealth Observability** dashboard
3. Observe the online-status panels at the bottom (row 36 onwards):
   - **Backend Online** — Green (1) = up, Red (0) = down
   - **Frontend Online** — Green (1) = up, Red (0) = down
   - **Grafana Online** — Green (1) = up, Red (0) = down
   - **Prometheus Online** — Green (1) = up, Red (0) = down
   - **cAdvisor Online** — Green (1) = up, Red (0) = down
   - **Uptime-Kuma Online** — Green (1) = up, Red (0) = down

The stopped service's panel will turn **red** within seconds.

### Docker Status Check

From the repository root:

```bash
docker ps
```

The stopped container will not appear in the list. To see all containers (including stopped):

```bash
docker ps -a
```

Look for a container with status `Exited`.

---

## Impact Assessment

### If `backend` is stopped
- Users cannot create or view appointments
- Authentication endpoints are unavailable
- Traffic simulator cannot run health checks or simulate load
- Backend metrics and logs stop flowing to Prometheus and Loki

### If `frontend` is stopped
- Users cannot access the web UI at `http://localhost:8080`
- The blackbox prober reports probe failure

### If `prometheus` is stopped
- Metrics collection halts; no new data points are added to the time-series database
- Grafana cannot query metrics; dashboards may show "No Data"
- Alerts cannot be evaluated (new alerts will not fire)

### If `grafana` is stopped
- Observability dashboards are inaccessible
- Operators lose visibility into system health

### If `cadvisor` is stopped
- Docker container metrics (CPU, memory, I/O) stop being collected
- Prometheus scrape job `cadvisor` fails

### If `uptime-kuma` is stopped
- The Uptime Kuma monitoring UI is inaccessible
- Uptime probe data stops flowing to Prometheus

---

## Recovery Procedure

### Step 1: Identify the Stopped Service

From the terminal, run:

```bash
docker ps -a
```

Look for a container with status `Exited` and note its service name from the `NAMES` column. For example:
```
CONTAINER ID   IMAGE             STATUS                 NAMES
abc123def456   node:18-alpine    Exited (0) 1 min ago   css519project-backend-1
```

In this case, the service is `backend`.

Cofirm this by checking the Prometheus alerts or Grafana dashboard (see Detection section above).

### Step 2: Restart the Container

From the command line, run:

```bash
docker compose restart <service-name>
```

Replace `<service-name>` with one of: `backend`, `frontend`, `prometheus`, `grafana`, `cadvisor`, or `uptime-kuma`.

**Example:**

```bash
docker compose restart backend
```

Docker Compose will:
1. Find the stopped container
2. Start it with the same configuration
3. Re-attach volumes and environment variables
4. Restart dependent services if needed (according to `depends_on` in `docker-compose.yml`)

### Step 3: Verify Recovery

#### Using Docker

```bash
docker ps
```

The service should now appear with status `Up`.

#### Using Prometheus

1. Open `http://localhost:9090`
2. Go to **Alerts**
3. Confirm the alert state has changed from `FIRING` to `OK` or is no longer listed

#### Using Grafana

1. Open `http://localhost:3002`
2. View the **ElgHealth Observability** dashboard
3. Confirm the online-status panel for the service has turned **green**

Typically, recovery is visible within **15–30 seconds** after the container starts.

#### Using Kuma

1. Open `http://localhost:3001`
2. View the dashboard to confrim that the previously failing service shows "OK"
3. Additionally, click onto the service and view the specific dashboard for more information.

#### Verify Data Flow

- **Backend logs**: Check `http://localhost:3000/health` (should return 200 OK with health status)
- **Frontend UI**: Confirm you can access `http://localhost:8080`
- **Prometheus metrics**: Verify metrics are flowing by checking `http://localhost:9090/graph` and querying a metric like `up{job="backend"}`
- **Grafana dashboards**: Panels should display data; no "No Data" warnings

---

## Post-Incident Steps

### 1. Review Logs

Check the restarted container's logs to identify any startup errors:

```bash
docker compose logs <service-name>
```

### 2. Verify Data Continuity

After 2–3 minutes of normal operation, confirm that:
- Metrics are being scraped and stored in Prometheus
- Logs are being collected in Loki
- No errors appear in the Prometheus alert state
- Traffic simulator is generating fresh events

### 3. Document the Incident

- Record the date, time, service name, and duration of the outage
- Note any cascading impacts (e.g., if Prometheus was down, which other services were affected?)
- Update relevant documentation if the root cause suggests a systemic issue

---

## Rollback / Escalation

If the container fails to restart or continuously crashes:

1. **Check container logs for errors:**
   ```bash
   docker compose logs <service-name> --tail=50
   ```

2. **Attempt a full rebuild:**
   ```bash
   docker compose down
   docker compose up --build
   ```

3. **If the issue persists**, escalate to the development team with:
   - Service name and timestamp
   - Container logs and Prometheus/Grafana screenshots
   - Any recent changes to configuration or code

---

## Appendix: Running the Incident Simulation

To manually trigger this incident for testing or chaos engineering:

### PowerShell
```powershell
.\scripts\stop_random_container.ps1
```

Or with a dry-run (shows which service would be stopped without actually stopping it):
```powershell
.\scripts\stop_random_container.ps1 -DryRun
```

---

## Related Documentation

- [Project/DOCKER.md](Project/DOCKER.md) — Docker Compose setup and dashboard URLs
- [OE/prometheus/rules.yml](OE/prometheus/rules.yml) — Alert rules configuration
- [OE/grafana/dashboards/elghealth-observability.json](OE/grafana/dashboards/elghealth-observability.json) — Dashboard panel configuration
