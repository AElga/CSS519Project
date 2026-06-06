const express = require("express");
const cors = require("cors");

const authRoutes = require("./routes/auth");
const appointmentRoutes = require("./routes/appointments");
const observabilityRoutes = require("./routes/observability");
const { metricsMiddleware, getMetricsSnapshot, getLiveSummary } = require("./metrics");
const { logEvent } = require("./logger");
const { getJwtSecret } = require("./auth-utils");

const app = express();

const defaultAllowedOrigins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:8080",
    "http://127.0.0.1:8080"
];

const allowedOrigins = (process.env.ALLOWED_ORIGINS || defaultAllowedOrigins.join(","))
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

if (process.env.NODE_ENV === "production" && getJwtSecret() === "dev-only-insecure-secret") {
    throw new Error("JWT_SECRET must be configured in production");
}

app.use(cors({
    origin(origin, callback) {
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
            return;
        }

        callback(new Error("Origin not allowed by CORS policy"));
    }
}));
app.use(express.json());
app.use(metricsMiddleware);

app.use("/auth", authRoutes);
app.use("/appointments", appointmentRoutes);
app.use("/observability", observabilityRoutes);

app.get("/", (req, res) => {
    res.send("ElgHealth API Running");
});

app.get("/health", (req, res) => {
    res.json({ status: "ok", service: "backend", timestamp: new Date().toISOString() });
});

app.get("/observability/summary", async (req, res) => {
    const summary = await getLiveSummary();
    res.json(summary);
});

app.get("/metrics", async (req, res, next) => {
    try {
        res.type("text/plain; version=0.0.4; charset=utf-8");
        res.send(await getMetricsSnapshot());
    } catch (err) {
        next(err);
    }
});

app.use((err, req, res, next) => {
    logEvent("error", "unhandled_request_error", {
        path: req.path,
        method: req.method,
        error: err.message
    });
    res.status(500).json({ error: "Internal server error" });
});

module.exports = app;
