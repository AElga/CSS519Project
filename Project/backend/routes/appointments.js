const express = require("express");
const { db, logsDb, runTracked, allTracked } = require("../db");
const { recordAppointmentCreated, recordAuditEvent } = require("../metrics");
const { logEvent } = require("../logger");

const router = express.Router();

router.post("/", (req, res) => {

    const { patient_id, doctor_id, appointment_time } = req.body;

    runTracked(
        db,
        `INSERT INTO appointments(patient_id,doctor_id,appointment_time,status)
         VALUES(?,?,?,?)`,
        [patient_id, doctor_id, appointment_time, "scheduled"],
        { table: "appointments" },
        function(err) {

            if (err) {
                logEvent("error", "appointment_create_failed", {
                    patient_id,
                    doctor_id,
                    appointment_time,
                    error: err.message
                });
                return res.status(400).json(err);
            }

            recordAppointmentCreated();
            logEvent("info", "appointment_created", {
                appointment_id: this.lastID,
                patient_id,
                doctor_id,
                appointment_time
            });
            runTracked(
                logsDb,
                `INSERT INTO audit_logs(event_type, user_email, user_id, event_time)
                 VALUES (?, ?, ?, ?)`,
                ["appointment_created", `patient-${patient_id}@local`, patient_id, new Date().toISOString()],
                { table: "audit_logs" },
                (auditErr) => {
                    if (!auditErr) {
                        recordAuditEvent("appointment_created");
                    }

                    res.json({ appointment_id: this.lastID });
                }
            );
        }
    );
});

router.get("/:user_id", (req, res) => {

    const userId = req.params.user_id;

    allTracked(
        db,
        `SELECT * FROM appointments 
         WHERE patient_id=? OR doctor_id=?`,
        [userId, userId],
        { table: "appointments" },
        (err, rows) => {
            if (err) {
                logEvent("error", "appointment_list_failed", { user_id: userId, error: err.message });
                return res.status(500).json({ error: "Failed to load appointments" });
            }

            logEvent("info", "appointment_list_loaded", { user_id: userId, rows: rows.length });
            res.json(rows);
        }
    );
});

module.exports = router;
