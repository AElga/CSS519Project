const express = require("express");
const bcrypt = require("bcrypt");
const { db, logsDb, runTracked, getTracked } = require("../db");
const { recordLoginAttempt, recordAuditEvent } = require("../metrics");
const { logEvent } = require("../logger");

const router = express.Router();

function writeAuditLog(eventType, user, callback) {
    runTracked(
        logsDb,
        `INSERT INTO audit_logs(event_type, user_email, user_id, event_time)
         VALUES (?, ?, ?, ?)`,
        [eventType, user.email, user.user_id || null, new Date().toISOString()],
        { table: "audit_logs" },
        (err) => {
            if (err) {
                console.error("Failed to write audit log", err);
            } else {
                recordAuditEvent(eventType);
            }

            callback();
        }
    );
}

router.post("/register", async (req, res) => {

    const { name, email, password, role } = req.body;

    const hash = await bcrypt.hash(password, 10);

    runTracked(
        db,
        "INSERT INTO users(name,email,password_hash,role) VALUES (?,?,?,?)",
        [name, email, hash, role],
        { table: "users" },
        function(err) {

            if (err) {
                logEvent("error", "auth_register_failed", { email, error: err.message });
                return res.status(400).json(err);
            }

            logEvent("info", "auth_register_success", { email, user_id: this.lastID, role });
            res.json({ user_id: this.lastID });
        }
    );
});

router.post("/login", (req, res) => {

    const { email, password } = req.body;

    getTracked(
        db,
        "SELECT * FROM users WHERE email=?",
        [email],
        { table: "users" },
        async (err, user) => {
            if (err) {
                logEvent("error", "auth_lookup_failed", { email, error: err.message });
                return res.status(500).send("Authentication lookup failed");
            }

            if (!user) {
                recordLoginAttempt("user_not_found");
                logEvent("warn", "auth_login_user_not_found", { email });
                return writeAuditLog("login_user_not_found", { email }, () => {
                    res.status(401).send("User not found");
                });
            }

            const valid = await bcrypt.compare(password, user.password_hash);

            if (!valid) {
                recordLoginAttempt("invalid_password");
                logEvent("warn", "auth_login_invalid_password", { email, user_id: user.user_id });
                return writeAuditLog("login_invalid_password", user, () => {
                    res.status(401).send("Invalid password");
                });
            }

            writeAuditLog("login_success", user, () => {
                recordLoginAttempt("success");
                logEvent("info", "auth_login_success", { email, user_id: user.user_id, role: user.role });
                res.json({
                    user_id: user.user_id,
                    name: user.name,
                    email: user.email,
                    role: user.role
                });
            });
        }
    );
});

module.exports = router;
