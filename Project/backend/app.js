const express = require("express");
const cors = require("cors");

const authRoutes = require("./routes/auth");
const appointmentRoutes = require("./routes/appointments");
const observabilityRoutes = require("./routes/observability");
const { metricsMiddleware, getMetricsSnapshot, getLiveSummary } = require("./metrics");
const { logEvent } = require("./logger");

const app = express();

app.use(cors());
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
