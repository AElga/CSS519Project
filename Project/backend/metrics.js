const fs = require("fs");
const { dbPath, logsDbPath } = require("./paths");

const requestDurationBuckets = [0.05, 0.1, 0.25, 0.5, 1, 2.5, 5];

const state = {
    httpRequestsTotal: new Map(),
    httpRequestDurationSeconds: new Map(),
    loginAttemptsTotal: new Map(),
    appointmentsCreatedTotal: 0
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

function readFileSize(targetPath) {
    try {
        return fs.statSync(targetPath).size;
    } catch {
        return 0;
    }
}

function buildGauge(name, help, value) {
    return [
        `# HELP ${name} ${help}`,
        `# TYPE ${name} gauge`,
        `${name} ${value}`
    ];
}

function getMetricsSnapshot() {
    const memoryUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    const uptimeSeconds = process.uptime();
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

    return `${lines.join("\n")}\n`;
}

module.exports = {
    metricsMiddleware,
    recordAppointmentCreated,
    recordLoginAttempt,
    getMetricsSnapshot
};
