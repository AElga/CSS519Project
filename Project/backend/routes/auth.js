const express = require("express");
const bcrypt = require("bcrypt");
const { db, logsDb, runTracked, getTracked } = require("../db");
const { recordLoginAttempt, recordAuditEvent } = require("../metrics");
const { logEvent } = require("../logger");
const { signAuthToken } = require("../auth-utils");

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
    const normalizedEmail = String(email || "").trim().toLowerCase();
    const normalizedRole = String(role || "").trim().toLowerCase();

    if (!name || !normalizedEmail || !password || !["patient", "doctor"].includes(normalizedRole)) {
        return res.status(400).json({ error: "Valid name, email, password, and role are required" });
    }

    if (String(password).length < 12) {
        return res.status(400).json({ error: "Password must be at least 12 characters long" });
    }

    const hash = await bcrypt.hash(password, 10);

    runTracked(
        db,
        "INSERT INTO users(name,email,password_hash,role) VALUES (?,?,?,?)",
        [name, normalizedEmail, hash, normalizedRole],
        { table: "users" },
        function(err) {

            if (err) {
                logEvent("error", "auth_register_failed", { email: normalizedEmail, error: err.message });
                return res.status(400).json({ error: "Registration failed" });
            }

            logEvent("info", "auth_register_success", {
                email: normalizedEmail,
                user_id: this.lastID,
                role: normalizedRole
            });
            res.json({ user_id: this.lastID });
        }
    );
});

router.post("/login", (req, res) => {
    const { email, password } = req.body;
    const normalizedEmail = String(email || "").trim().toLowerCase();

    if (!normalizedEmail || !password) {
        return res.status(400).json({ error: "Email and password are required" });
    }

    getTracked(
        db,
        "SELECT * FROM users WHERE email=?",
        [normalizedEmail],
        { table: "users" },
        async (err, user) => {
            if (err) {
                logEvent("error", "auth_lookup_failed", { email: normalizedEmail, error: err.message });
                return res.status(500).send("Authentication lookup failed");
            }

            if (!user) {
                recordLoginAttempt("user_not_found");
                logEvent("warn", "auth_login_user_not_found", { email: normalizedEmail });
                return writeAuditLog("login_user_not_found", { email: normalizedEmail }, () => {
                    res.status(401).send("User not found");
                });
            }

            const valid = await bcrypt.compare(password, user.password_hash);

            if (!valid) {
                recordLoginAttempt("invalid_password");
                logEvent("warn", "auth_login_invalid_password", { email: normalizedEmail, user_id: user.user_id });
                return writeAuditLog("login_invalid_password", user, () => {
                    res.status(401).send("Invalid password");
                });
            }

            writeAuditLog("login_success", user, () => {
                recordLoginAttempt("success");
                const token = signAuthToken(user);

                logEvent("info", "auth_login_success", {
                    email: normalizedEmail,
                    user_id: user.user_id,
                    role: user.role
                });
                res.json({
                    token,
                    user: {
                        user_id: user.user_id,
                        name: user.name,
                        email: user.email,
                        role: user.role
                    }
                });
            });
        }
    );
});

module.exports = router;
