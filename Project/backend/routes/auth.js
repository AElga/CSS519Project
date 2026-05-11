const express = require("express");
const bcrypt = require("bcrypt");
const { db, logsDb } = require("../db");
const { recordLoginAttempt } = require("../metrics");

const router = express.Router();

function writeAuditLog(user, callback) {
    logsDb.run(
        `INSERT INTO audit_logs(event_type, user_email, user_id, event_time)
         VALUES (?, ?, ?, ?)`,
        ["login_success", user.email, user.user_id, new Date().toISOString()],
        (err) => {
            if (err) {
                console.error("Failed to write audit log", err);
            }

            callback();
        }
    );
}

router.post("/register", async (req, res) => {

    const { name, email, password, role } = req.body;

    const hash = await bcrypt.hash(password, 10);

    db.run(
        "INSERT INTO users(name,email,password_hash,role) VALUES (?,?,?,?)",
        [name, email, hash, role],
        function(err) {

            if (err) {
                return res.status(400).json(err);
            }

            res.json({ user_id: this.lastID });
        }
    );
});

router.post("/login", (req, res) => {

    const { email, password } = req.body;

    db.get(
        "SELECT * FROM users WHERE email=?",
        [email],
        async (err, user) => {

            if (!user) {
                recordLoginAttempt("user_not_found");
                return res.status(401).send("User not found");
            }

            const valid = await bcrypt.compare(password, user.password_hash);

            if (!valid) {
                recordLoginAttempt("invalid_password");
                return res.status(401).send("Invalid password");
            }

            writeAuditLog(user, () => {
                recordLoginAttempt("success");
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
