const fs = require("fs");
const path = require("path");

const rootDir = path.resolve(__dirname, "..");

function readFile(relativePath) {
    return fs.readFileSync(path.join(rootDir, relativePath), "utf8");
}

function assert(condition, message) {
    if (!condition) {
        throw new Error(message);
    }
}

function runTest(name, testFn, failures) {
    process.stdout.write(`[RUN ] ${name}\n`);

    try {
        testFn();
        process.stdout.write(`[PASS] ${name}\n\n`);
    } catch (error) {
        failures.push(`${name}: ${error.message}`);
        process.stdout.write(`[FAIL] ${name}\n`);
        process.stdout.write(`    ${error.message}\n\n`);
    }
}

function normalizeLineEndings(value) {
    return value.replace(/\r\n/g, "\n");
}

function main() {
    const failures = [];
    const datasources = normalizeLineEndings(readFile("OE/grafana/provisioning/datasources/datasources.yml"));
    const dashboardsProvisioning = normalizeLineEndings(readFile("OE/grafana/provisioning/dashboards/dashboards.yml"));
    const dashboardJson = JSON.parse(readFile("OE/grafana/dashboards/elghealth-observability.json"));
    const blackboxConfig = normalizeLineEndings(readFile("OE/blackbox/blackbox.yml"));
    const lokiConfig = normalizeLineEndings(readFile("OE/loki/config.yml"));
    const promtailConfig = normalizeLineEndings(readFile("OE/promtail/config.yml"));
    const composeFile = normalizeLineEndings(readFile("docker-compose.yml"));

    runTest("Grafana datasources are provisioned", () => {
        assert(datasources.includes("name: Prometheus"), "Missing Prometheus datasource.");
        assert(datasources.includes("uid: prometheus"), "Missing Prometheus datasource UID.");
        assert(datasources.includes("url: http://prometheus:9090"), "Prometheus datasource URL is incorrect.");
        assert(datasources.includes("name: Loki"), "Missing Loki datasource.");
        assert(datasources.includes("uid: loki"), "Missing Loki datasource UID.");
        assert(datasources.includes("url: http://loki:3100"), "Loki datasource URL is incorrect.");
    }, failures);

    runTest("Grafana dashboard provider points at mounted dashboards", () => {
        assert(dashboardsProvisioning.includes("folder: ElgHealth"), "Dashboard folder provisioning is missing.");
        assert(
            dashboardsProvisioning.includes("path: /var/lib/grafana/dashboards"),
            "Dashboard provider path does not match the Grafana mount."
        );
    }, failures);

    runTest("Grafana dashboard JSON is structurally valid", () => {
        assert(dashboardJson.uid === "elghealth-observability", "Unexpected dashboard UID.");
        assert(dashboardJson.title === "ElgHealth Observability", "Unexpected dashboard title.");
        assert(Array.isArray(dashboardJson.panels), "Dashboard panels are missing.");
        assert(dashboardJson.panels.length >= 10, "Dashboard does not contain the expected number of panels.");
    }, failures);

    runTest("Grafana panels only reference provisioned datasources", () => {
        const allowedUids = new Set(["prometheus", "loki"]);

        for (const panel of dashboardJson.panels) {
            if (!panel.datasource || !panel.datasource.uid) {
                continue;
            }

            assert(
                allowedUids.has(panel.datasource.uid),
                `Panel "${panel.title}" references unknown datasource UID "${panel.datasource.uid}".`
            );
        }
    }, failures);

    runTest("Grafana dashboard covers key observability views", () => {
        const panelTitles = new Set(dashboardJson.panels.map((panel) => panel.title));
        const requiredPanels = [
            "Backend Online",
            "Frontend Online",
            "API Request Rate",
            "API Latency p95",
            "DB Operations",
            "Application Logs"
        ];

        for (const title of requiredPanels) {
            assert(panelTitles.has(title), `Missing required panel "${title}".`);
        }
    }, failures);

    runTest("Grafana dashboard queries match expected live signals", () => {
        const allExpressions = dashboardJson.panels
            .flatMap((panel) => panel.targets || [])
            .map((target) => target.expr || "")
            .join("\n");

        assert(allExpressions.includes("elghealth_http_requests_total"), "Missing API traffic query.");
        assert(allExpressions.includes("elghealth_http_request_duration_seconds_bucket"), "Missing API latency query.");
        assert(allExpressions.includes("elghealth_db_operations_total"), "Missing DB operations query.");
        assert(allExpressions.includes("probe_success"), "Missing uptime probe query.");
        assert(allExpressions.includes("{job=\"elghealth-app-logs\"}"), "Missing Loki log query.");
    }, failures);

    runTest("Blackbox exporter is configured for HTTP health probes", () => {
        assert(blackboxConfig.includes("http_2xx:"), "Missing blackbox HTTP module.");
        assert(blackboxConfig.includes("prober: http"), "Blackbox module is not using the HTTP prober.");
        assert(blackboxConfig.includes("method: GET"), "Blackbox module is not using GET probes.");
    }, failures);

    runTest("Loki and Promtail are wired together", () => {
        assert(lokiConfig.includes("http_listen_port: 3100"), "Loki HTTP port is incorrect.");
        assert(promtailConfig.includes("url: http://loki:3100/loki/api/v1/push"), "Promtail is not pushing to Loki.");
        assert(promtailConfig.includes("__path__: /var/log/elghealth/app.log"), "Promtail is not tailing app.log.");
        assert(promtailConfig.includes("job: elghealth-app-logs"), "Promtail job label is incorrect.");
    }, failures);

    runTest("Docker Compose mounts and starts the dashboard services", () => {
        const requiredComposeEntries = [
            "grafana:",
            "loki:",
            "promtail:",
            "cadvisor:",
            "blackbox-exporter:",
            "uptime-kuma:",
            "GF_DASHBOARDS_DEFAULT_HOME_DASHBOARD_PATH: /var/lib/grafana/dashboards/elghealth-observability.json",
            "./OE/grafana/provisioning:/etc/grafana/provisioning:ro",
            "./OE/grafana/dashboards:/var/lib/grafana/dashboards:ro",
            "./OE/loki/config.yml:/etc/loki/config.yml:ro",
            "./OE/promtail/config.yml:/etc/promtail/config.yml:ro",
            "./OE/blackbox/blackbox.yml:/etc/blackbox_exporter/config.yml:ro"
        ];

        for (const entry of requiredComposeEntries) {
            assert(composeFile.includes(entry), `Missing Compose entry: ${entry}`);
        }
    }, failures);

    process.stdout.write(`Summary: ${9 - failures.length} passed, ${failures.length} failed, 9 total.\n`);

    if (failures.length > 0) {
        process.exit(1);
    }
}

main();
