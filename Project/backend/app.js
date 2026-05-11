const express = require("express");
const cors = require("cors");

const authRoutes = require("./routes/auth");
const appointmentRoutes = require("./routes/appointments");
const { metricsMiddleware, getMetricsSnapshot } = require("./metrics");

const app = express();

app.use(cors());
app.use(express.json());
app.use(metricsMiddleware);

app.use("/auth", authRoutes);
app.use("/appointments", appointmentRoutes);

app.get("/", (req, res) => {
    res.send("ElgHealth API Running");
});

app.get("/health", (req, res) => {
    res.json({ status: "ok" });
});

app.get("/metrics", (req, res) => {
    res.type("text/plain; version=0.0.4; charset=utf-8");
    res.send(getMetricsSnapshot());
});

module.exports = app;
