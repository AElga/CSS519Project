const express = require("express");
const cors = require("cors");

const authRoutes = require("./routes/auth");
const appointmentRoutes = require("./routes/appointments");

const app = express();

app.use(cors());
app.use(express.json());

app.use("/auth", authRoutes);
app.use("/appointments", appointmentRoutes);

app.get("/", (req, res) => {
    res.send("ElgHealth API Running");
});

app.get("/health", (req, res) => {
    res.json({ status: "ok" });
});

module.exports = app;
