const fs = require("fs");
const { dbPath, logsDbPath, appLogPath } = require("./paths");

const requestDurationBuckets = [0.05, 0.1, 0.25, 0.5, 1, 2.5, 5];
const dbDurationBuckets = [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5];

const state = {
    httpRequestsTotal: new Map(),
    httpRequestDurationSeconds: new Map(),
    loginAttemptsTotal: new Map(),
    appointmentsCreatedTotal: 0,
    uiInteractionsTotal: new Map(),
    auditEventsTotal: new Map(),
    appLogEventsTotal: new Map(),
    dbOperationsTotal: new Map(),
    dbOperationDurationSeconds: new Map()
};

function escapeLabelValue(value) {
    return String(value)
        .replace(/\\/g, "\\\\")
        .replace(/\n/g, "\\n")
        .replace(/"/g, '\\"');
}

function labelsKey(labels) {
    return Object.entries(labels)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, value]) => `${key}:${value}`)
        .join("|");
}

function formatLabels(labels) {
    const entries = Object.entries(labels);

    if (entries.length === 0) {
        return "";
    }

    return `{${entries
        .map(([key, value]) => `${key}="${escapeLabelValue(value)}"`)
        .join(",")}}`;
}

function incrementCounter(map, labels, amount = 1) {
    const key = labelsKey(labels);
    const existing = map.get(key);

    if (existing) {
        existing.value += amount;
        return;
    }

    map.set(key, { labels, value: amount });
}

function observeHistogram(map, labels, value, buckets) {
    const key = labelsKey(labels);
    const existing = map.get(key);

    if (existing) {
        existing.count += 1;
        existing.sum += value;

        for (let index = 0; index < buckets.length; index += 1) {
            if (value <= buckets[index]) {
                existing.bucketCounts[index] += 1;
            }
        }

        if (value > buckets[buckets.length - 1]) {
            existing.bucketCounts[buckets.length] += 1;
        }

        return;
    }

    const bucketCounts = new Array(buckets.length + 1).fill(0);

    for (let index = 0; index < buckets.length; index += 1) {
        if (value <= buckets[index]) {
            bucketCounts[index] += 1;
        }
    }

    if (value > buckets[buckets.length - 1]) {
        bucketCounts[buckets.length] += 1;
    }

    map.set(key, {
        labels,
        count: 1,
        sum: value,
        bucketCounts
    });
}

function readFileSize(targetPath) {
    try {
        return fs.statSync(targetPath).size;
    } catch {
        return 0;
    }
}

function buildCounter(name, help, map) {
    const lines = [
        `# HELP ${name} ${help}`,
        `# TYPE ${name} counter`
    ];

    for (const { labels, value } of map.values()) {
        lines.push(`${name}${formatLabels(labels)} ${value}`);
    }

    return lines;
}

function buildHistogram(name, help, map, buckets) {
    const lines = [
        `# HELP ${name} ${help}`,
        `# TYPE ${name} histogram`
    ];

    for (const { labels, count, sum, bucketCounts } of map.values()) {
        let cumulative = 0;

        for (let index = 0; index < buckets.length; index += 1) {
            cumulative += bucketCounts[index];
            lines.push(`${name}_bucket${formatLabels({ ...labels, le: String(buckets[index]) })} ${cumulative}`);
        }

        lines.push(`${name}_bucket${formatLabels({ ...labels, le: "+Inf" })} ${count}`);
        lines.push(`${name}_sum${formatLabels(labels)} ${sum}`);
        lines.push(`${name}_count${formatLabels(labels)} ${count}`);
    }

    return lines;
}

function buildGauge(name, help, value) {
    return [
        `# HELP ${name} ${help}`,
        `# TYPE ${name} gauge`,
        `${name} ${value}`
    ];
}

function buildLabeledGauges(name, help, series) {
    const lines = [
        `# HELP ${name} ${help}`,
        `# TYPE ${name} gauge`
    ];

    for (const item of series) {
        lines.push(`${name}${formatLabels(item.labels)} ${item.value}`);
    }

    return lines;
}

function recordHttpRequest(route, method, statusCode, durationSeconds) {
    const labels = {
        method: method.toUpperCase(),
        route,
        status: String(statusCode)
    };

    incrementCounter(state.httpRequestsTotal, labels);
    observeHistogram(state.httpRequestDurationSeconds, labels, durationSeconds, requestDurationBuckets);
}

function recordLoginAttempt(outcome) {
    incrementCounter(state.loginAttemptsTotal, { outcome });
}

function recordAppointmentCreated() {
    state.appointmentsCreatedTotal += 1;
}

function recordUiInteraction(surface, event) {
    incrementCounter(state.uiInteractionsTotal, { surface, event });
}

function recordAuditEvent(eventType) {
    incrementCounter(state.auditEventsTotal, { event_type: eventType });
}

function recordAppLogEvent(level, event) {
    incrementCounter(state.appLogEventsTotal, { level, event });
}

function recordDbOperation(operation, table, outcome, durationSeconds) {
    const labels = { operation, table, outcome };
    incrementCounter(state.dbOperationsTotal, labels);
    observeHistogram(state.dbOperationDurationSeconds, labels, durationSeconds, dbDurationBuckets);
}

function detectRoute(req) {
    if (req.route && req.route.path) {
        return `${req.baseUrl || ""}${req.route.path}`;
    }

    if (req.path === "/metrics") {
        return "/metrics";
    }

    return "unmatched";
}

function metricsMiddleware(req, res, next) {
    const start = process.hrtime.bigint();

    res.on("finish", () => {
        const durationSeconds = Number(process.hrtime.bigint() - start) / 1e9;
        recordHttpRequest(detectRoute(req), req.method, res.statusCode, durationSeconds);
    });

    next();
}

function querySingleValue(database, sql, params = []) {
    return new Promise((resolve, reject) => {
        database.get(sql, params, (err, row) => {
            if (err) {
                reject(err);
                return;
            }

            const firstValue = row ? Object.values(row)[0] : 0;
            resolve(firstValue || 0);
        });
    });
}

async function getDynamicState() {
    const { db, logsDb } = require("./db");

    const [
        usersCount,
        appointmentsCount,
        archivedAppointmentsCount,
        recordsCount,
        auditLogsCount
    ] = await Promise.all([
        querySingleValue(db, "SELECT COUNT(*) FROM users"),
        querySingleValue(db, "SELECT COUNT(*) FROM appointments"),
        querySingleValue(db, "SELECT COUNT(*) FROM archived_appointments"),
        querySingleValue(db, "SELECT COUNT(*) FROM records"),
        querySingleValue(logsDb, "SELECT COUNT(*) FROM audit_logs")
    ]);

    return {
        usersCount,
        appointmentsCount,
        archivedAppointmentsCount,
        recordsCount,
        auditLogsCount
    };
}

async function getMetricsSnapshot() {
    const memoryUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    const uptimeSeconds = process.uptime();
    const dynamicState = await getDynamicState();
    const lines = [];

    lines.push(...buildCounter(
        "elghealth_http_requests_total",
        "Total HTTP requests handled by the API.",
        state.httpRequestsTotal
    ));
    lines.push(...buildHistogram(
        "elghealth_http_request_duration_seconds",
        "HTTP request duration in seconds.",
        state.httpRequestDurationSeconds,
        requestDurationBuckets
    ));
    lines.push(...buildCounter(
        "elghealth_login_attempts_total",
        "Login attempts grouped by outcome.",
        state.loginAttemptsTotal
    ));
    lines.push(...buildCounter(
        "elghealth_ui_interactions_total",
        "UI interactions grouped by surface and event.",
        state.uiInteractionsTotal
    ));
    lines.push(...buildCounter(
        "elghealth_audit_events_total",
        "Audit log events grouped by event type.",
        state.auditEventsTotal
    ));
    lines.push(...buildCounter(
        "elghealth_app_log_events_total",
        "Structured application log entries grouped by level and event.",
        state.appLogEventsTotal
    ));
    lines.push(...buildCounter(
        "elghealth_db_operations_total",
        "Database operations grouped by operation, table, and outcome.",
        state.dbOperationsTotal
    ));
    lines.push(...buildHistogram(
        "elghealth_db_operation_duration_seconds",
        "Database operation duration in seconds.",
        state.dbOperationDurationSeconds,
        dbDurationBuckets
    ));
    lines.push(...buildGauge(
        "elghealth_appointments_created_total",
        "Total appointments created since the server started.",
        state.appointmentsCreatedTotal
    ));
    lines.push(...buildGauge(
        "elghealth_process_uptime_seconds",
        "Node.js process uptime in seconds.",
        uptimeSeconds
    ));
    lines.push(...buildGauge(
        "elghealth_process_resident_memory_bytes",
        "Resident memory used by the Node.js process.",
        memoryUsage.rss
    ));
    lines.push(...buildGauge(
        "elghealth_process_heap_used_bytes",
        "Heap memory currently used by the Node.js process.",
        memoryUsage.heapUsed
    ));
    lines.push(...buildGauge(
        "elghealth_process_cpu_user_seconds_total",
        "User CPU time consumed by the Node.js process.",
        cpuUsage.user / 1e6
    ));
    lines.push(...buildGauge(
        "elghealth_process_cpu_system_seconds_total",
        "System CPU time consumed by the Node.js process.",
        cpuUsage.system / 1e6
    ));
    lines.push(...buildGauge(
        "elghealth_database_file_size_bytes",
        "SQLite application database file size in bytes.",
        readFileSize(dbPath)
    ));
    lines.push(...buildGauge(
        "elghealth_audit_log_file_size_bytes",
        "SQLite audit log database file size in bytes.",
        readFileSize(logsDbPath)
    ));
    lines.push(...buildGauge(
        "elghealth_app_log_file_size_bytes",
        "Structured application log file size in bytes.",
        readFileSize(appLogPath)
    ));
    lines.push(...buildLabeledGauges(
        "elghealth_table_rows",
        "Current row counts per table.",
        [
            { labels: { table: "users" }, value: dynamicState.usersCount },
            { labels: { table: "appointments" }, value: dynamicState.appointmentsCount },
            { labels: { table: "archived_appointments" }, value: dynamicState.archivedAppointmentsCount },
            { labels: { table: "records" }, value: dynamicState.recordsCount },
            { labels: { table: "audit_logs" }, value: dynamicState.auditLogsCount }
        ]
    ));

    return `${lines.join("\n")}\n`;
}

function sumMapValues(map) {
    let total = 0;

    for (const { value } of map.values()) {
        total += value;
    }

    return total;
}

async function getLiveSummary() {
    const dynamicState = await getDynamicState();

    return {
        process: {
            uptime_seconds: process.uptime(),
            memory_rss_bytes: process.memoryUsage().rss,
            heap_used_bytes: process.memoryUsage().heapUsed
        },
        counters: {
            http_requests_total: sumMapValues(state.httpRequestsTotal),
            login_attempts_total: sumMapValues(state.loginAttemptsTotal),
            appointments_created_total: state.appointmentsCreatedTotal,
            ui_interactions_total: sumMapValues(state.uiInteractionsTotal),
            audit_events_total: sumMapValues(state.auditEventsTotal),
            app_log_events_total: sumMapValues(state.appLogEventsTotal),
            db_operations_total: sumMapValues(state.dbOperationsTotal)
        },
        storage: {
            application_db_bytes: readFileSize(dbPath),
            audit_db_bytes: readFileSize(logsDbPath),
            app_log_bytes: readFileSize(appLogPath)
        },
        rows: {
            users: dynamicState.usersCount,
            appointments: dynamicState.appointmentsCount,
            archived_appointments: dynamicState.archivedAppointmentsCount,
            records: dynamicState.recordsCount,
            audit_logs: dynamicState.auditLogsCount
        }
    };
}

module.exports = {
    metricsMiddleware,
    recordAppointmentCreated,
    recordLoginAttempt,
    recordUiInteraction,
    recordAuditEvent,
    recordAppLogEvent,
    recordDbOperation,
    getMetricsSnapshot,
    getLiveSummary
};
