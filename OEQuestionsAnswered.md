Note to Professor: since the first part of the assignment was assisted by AI, the fist and second sections (Stack and what it tracks) was heavly assisted by AI (written then I reviewed and made adjustments). The other two sections (questions answered and gaps) had the outline written by AI, but I went in and filled in gaps/updated language.

## Current OE Stack

- Metrics and dashboards: `Prometheus`, `Grafana`, backend `/metrics`, and backend `/observability/summary`
- Logs and uptime: `Loki`, `Promtail`, `Blackbox Exporter`, and `Uptime Kuma`
- Runtime activity and container visibility: `cAdvisor` plus the `traffic-simulator` container that continuously generates live app behavior

## What OE Tracks

### API and Service Behavior

- Traffic and outcomes: total requests, request rates, status codes, and error rates
- Performance: request latency histograms and p95-style latency queries
- Availability: backend health, frontend health, and Prometheus scrape status

### Authentication and Security Signals

- Login activity: successful logins, invalid passwords, and user-not-found attempts
- Security trends: failed-versus-successful login ratios
- Auditability: structured security-relevant logs plus audit log entries for login outcomes and appointment creation

### Database Activity

- Operations: database read/write counts, outcomes, and latency
- Data growth: row counts for `users`, `appointments`, `records`, and `audit_logs`
- Storage: application DB size, audit DB size, and growth under live traffic

### Logs and App Events

- Application logs: structured backend JSON logs and log event counts by level and event name
- Log access: live log streaming in Grafana through Loki
- Event correlation: audit log growth and UI telemetry from the frontend and simulator

### Frontend and UI Activity

- Navigation: page views and simulated dashboard view activity
- User actions: login form submissions, login successes, and login failures
- Workflow events: dashboard scheduling interactions

### Docker and Host-Adjacent Runtime Metrics

- Container resources: backend container CPU and memory usage plus key service CPU metrics
- Container visibility: container-level runtime metrics from cAdvisor
- Service status: frontend and backend online state via health probes

## Operational Questions OE Can Answer

### Grafana

Grafana can answer:

- Is the backend or frontend currently online?
- Are API requests succeeding, failing, or slowing down?
- Are login failures, UI interactions, and DB operations changing under live traffic?
- Are SQLite files and table row counts growing over time?
- Is backend container CPU or memory usage elevated (logs emitted to support claim)?

### Prometheus

Prometheus can answer:

- Is the backend metrics endpoint being scraped successfully?
- Is the API error ratio or p95 request latency elevated?
- Is the failed-login ratio high enough to indicate auth issues or abuse?
- Are alerting rules currently evaluating to warning or critical conditions?

### Loki

Loki can answer:

- What backend application events occurred at a specific time?
- Did a login fail because of bad credentials or a missing user?
- Were appointments successfully created and UI-related backend events emitted?
- Are warning or error log events increasing?

### Uptime Kuma

Uptime Kuma can answer:

- Is the monitored service reachable from an uptime-monitoring view (is the container properly running)?
- Has a service gone down and come back up?
- Is there a basic history of availability for the services being monitored?

### cAdvisor

cAdvisor can answer:

- How much CPU are the containers using?
- How much memory are the containers using?
- Are resource usage patterns changing while live traffic is being generated?

## Gaps and Limitations

### Third-Party Dependency Visibility

Current gap:

- there are no real third-party service dependencies instrumented
- there are no dependency-specific synthetic checks

Implication: OE cannot yet answer whether a real external provider is down or degraded

### Network Health Depth

Current gap:

- there is no packet-level or connection-pool telemetry
- there is no bandwidth, retransmit, or latency breakdown at the network layer

Implication: OE can detect service-level symptoms, but not deep network root causes

### Container Status Detail

Current gap:

- container health is inferred from `up`, probes, and cAdvisor metrics
- there is no dedicated alerting for restart loops, OOM kills, or exit-code history

Implication: OE can see when a service is unavailable, but not all lifecycle failure modes with precision (what was talked about in class when a service is up but not working for a client)

### Database Depth

Current gap:

- SQLite limits the richness of DB internals available
- there is no lock contention, index efficiency, slow-query log, or transaction queue analysis

Implication: OE can answer whether DB usage is occurring and whether it is slowing down, but not advanced database tuning questions

### Security Coverage Breadth

Current gap:

- there is no intrusion-detection system
- there is no WAF telemetry
- there is no IP-based auth analysis
- there is no session anomaly detection

Implication: OE provides basic operational security visibility, not full security monitoring

### Frontend Real User Monitoring

Current gap:

- there is no browser performance telemetry such as Core Web Vitals
- there is no client-side error aggregation
- there is no user session replay or navigation timing dashboard

Implication: OE sees UI interaction events, but not deep real, End-2-End user frontend performance

The main remaining gaps are deeper network telemetry, richer security analytics, more detailed container lifecycle diagnostics, and advanced database internals.
