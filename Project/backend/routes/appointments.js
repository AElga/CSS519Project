const express = require("express");
const { db, logsDb, runTracked, allTracked, getTracked } = require("../db");
const { recordAppointmentCreated, recordAuditEvent } = require("../metrics");
const { logEvent } = require("../logger");
const { authenticateRequest, requireRole } = require("../auth-utils");

const ACTIVE_APPOINTMENT_LIMIT = 3;
const router = express.Router();

router.use(authenticateRequest);

function getUserById(userId) {
    return new Promise((resolve, reject) => {
        getTracked(
            db,
            "SELECT user_id, name, email, role FROM users WHERE user_id = ?",
            [userId],
            { table: "users" },
            (err, user) => {
                if (err) {
                    reject(err);
                    return;
                }

                resolve(user);
            }
        );
    });
}

function getAllRows(sql, params, table) {
    return new Promise((resolve, reject) => {
        allTracked(db, sql, params, { table }, (err, rows) => {
            if (err) {
                reject(err);
                return;
            }

            resolve(rows);
        });
    });
}

function runStatement(database, sql, params, table) {
    return new Promise((resolve, reject) => {
        runTracked(database, sql, params, { table }, function onRun(err) {
            if (err) {
                reject(err);
                return;
            }

            resolve(this);
        });
    });
}

function getAppointmentTableConfig(scope = "active") {
    if (scope === "archived") {
        return {
            tableName: "archived_appointments",
            idColumn: "archived_appointment_id",
            alias: "archived_appointment_id AS appointment_id",
            tableLabel: "archived_appointments",
            source: "archived"
        };
    }

    return {
        tableName: "appointments",
        idColumn: "appointment_id",
        alias: "appointment_id AS appointment_id",
        tableLabel: "appointments",
        source: "active"
    };
}

async function archiveAppointmentRow(appointment) {
    await runStatement(
        db,
        `INSERT INTO archived_appointments(
            original_appointment_id,
            patient_id,
            doctor_id,
            appointment_time,
            status,
            archived_at
         ) VALUES (?, ?, ?, ?, ?, ?)`,
        [
            appointment.appointment_id,
            appointment.patient_id,
            appointment.doctor_id,
            appointment.appointment_time,
            "archived",
            new Date().toISOString()
        ],
        "archived_appointments"
    );

    await runStatement(
        db,
        "DELETE FROM appointments WHERE appointment_id = ?",
        [appointment.appointment_id],
        "appointments"
    );
}

async function enforceActiveAppointmentCap(patientId, doctorId) {
    const activeAppointments = await getAllRows(
        `SELECT appointment_id, patient_id, doctor_id, appointment_time, status
         FROM appointments
         WHERE patient_id = ? AND doctor_id = ?
         ORDER BY appointment_time ASC`,
        [patientId, doctorId],
        "appointments"
    );

    if (activeAppointments.length <= ACTIVE_APPOINTMENT_LIMIT) {
        return [];
    }

    const appointmentsToArchive = activeAppointments.slice(
        0,
        activeAppointments.length - ACTIVE_APPOINTMENT_LIMIT
    );

    for (const appointment of appointmentsToArchive) {
        await archiveAppointmentRow(appointment);
    }

    return appointmentsToArchive;
}

async function loadAppointmentsForUser(user, scope) {
    const tableConfig = getAppointmentTableConfig(scope);
    const isDoctor = user.role === "doctor";

    return getAllRows(
        `SELECT source_table.${tableConfig.alias},
                source_table.patient_id,
                source_table.doctor_id,
                source_table.appointment_time,
                source_table.status,
                patients.name AS patient_name,
                doctors.name AS doctor_name,
                '${tableConfig.source}' AS source
         FROM ${tableConfig.tableName} AS source_table
         JOIN users AS patients ON patients.user_id = source_table.patient_id
         JOIN users AS doctors ON doctors.user_id = source_table.doctor_id
         WHERE ${isDoctor ? "source_table.doctor_id = ?" : "source_table.patient_id = ?"}
         ORDER BY source_table.appointment_time ${scope === "archived" ? "DESC" : "ASC"}`,
        [user.user_id],
        tableConfig.tableLabel
    );
}

async function loadAppointmentDetails(user, appointmentId, scope) {
    const tableConfig = getAppointmentTableConfig(scope);
    const rolePredicate = user.role === "doctor"
        ? "source_table.doctor_id = ?"
        : "source_table.patient_id = ?";

    const appointmentRows = await getAllRows(
        `SELECT source_table.${tableConfig.alias},
                source_table.patient_id,
                source_table.doctor_id,
                source_table.appointment_time,
                source_table.status,
                patients.name AS patient_name,
                doctors.name AS doctor_name,
                '${tableConfig.source}' AS source
         FROM ${tableConfig.tableName} AS source_table
         JOIN users AS patients ON patients.user_id = source_table.patient_id
         JOIN users AS doctors ON doctors.user_id = source_table.doctor_id
         WHERE source_table.${tableConfig.idColumn} = ?
           AND ${rolePredicate}`,
        [appointmentId, user.user_id],
        tableConfig.tableLabel
    );

    const appointment = appointmentRows[0];

    if (!appointment) {
        return null;
    }

    const records = await getAllRows(
        `SELECT record_id, patient_id, doctor_id, notes, created_at
         FROM records
         WHERE patient_id = ? AND doctor_id = ?
         ORDER BY created_at DESC`,
        [appointment.patient_id, appointment.doctor_id],
        "records"
    );

    return { appointment, records };
}

async function writeAuditLog(eventType, userEmail, userId) {
    await runStatement(
        logsDb,
        `INSERT INTO audit_logs(event_type, user_email, user_id, event_time)
         VALUES (?, ?, ?, ?)`,
        [eventType, userEmail, userId, new Date().toISOString()],
        "audit_logs"
    );
    recordAuditEvent(eventType);
}

router.post("/", requireRole("patient"), async (req, res) => {
    const { patient_id, doctor_id, appointment_time } = req.body;
    const normalizedPatientId = Number(patient_id);
    const normalizedDoctorId = Number(doctor_id);

    if (!normalizedPatientId || !normalizedDoctorId || !appointment_time) {
        return res.status(400).json({ error: "patient_id, doctor_id, and appointment_time are required" });
    }

    if (req.auth.user_id !== normalizedPatientId) {
        return res.status(403).json({ error: "Patients may only schedule appointments for themselves" });
    }

    try {
        const doctor = await getUserById(normalizedDoctorId);

        if (!doctor || doctor.role !== "doctor") {
            return res.status(400).json({ error: "A valid doctor_id is required" });
        }

        const result = await runStatement(
            db,
            `INSERT INTO appointments(patient_id, doctor_id, appointment_time, status)
             VALUES (?, ?, ?, ?)`,
            [normalizedPatientId, normalizedDoctorId, appointment_time, "scheduled"],
            "appointments"
        );

        const archivedAppointments = await enforceActiveAppointmentCap(normalizedPatientId, normalizedDoctorId);

        recordAppointmentCreated();
        logEvent("info", "appointment_created", {
            appointment_id: result.lastID,
            patient_id: normalizedPatientId,
            doctor_id: normalizedDoctorId,
            appointment_time,
            archived_count: archivedAppointments.length
        });

        try {
            await writeAuditLog("appointment_created", req.auth.email, normalizedPatientId);
        } catch (auditErr) {
            logEvent("warn", "appointment_audit_log_failed", {
                patient_id: normalizedPatientId,
                doctor_id: normalizedDoctorId,
                appointment_id: result.lastID,
                error: auditErr.message
            });
        }

        res.json({
            appointment_id: result.lastID,
            archived_appointments: archivedAppointments.length
        });
    } catch (err) {
        logEvent("error", "appointment_create_failed", {
            patient_id: normalizedPatientId,
            doctor_id: normalizedDoctorId,
            appointment_time,
            error: err.message
        });
        res.status(400).json({ error: "Failed to create appointment" });
    }
});

router.get("/user/:user_id", async (req, res) => {
    const userId = Number(req.params.user_id);
    const scope = req.query.scope === "archived" ? "archived" : "active";

    if (!userId) {
        return res.status(400).json({ error: "Valid user_id is required" });
    }

    if (req.auth.user_id !== userId) {
        return res.status(403).json({ error: "Forbidden" });
    }

    try {
        const user = await getUserById(userId);

        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }

        const rows = await loadAppointmentsForUser(user, scope);

        logEvent("info", "appointment_list_loaded", {
            user_id: userId,
            role: user.role,
            scope,
            rows: rows.length
        });
        res.json(rows);
    } catch (err) {
        logEvent("error", "appointment_list_failed", {
            user_id: userId,
            scope,
            error: err.message
        });
        res.status(500).json({ error: "Failed to load appointments" });
    }
});

router.get("/:appointment_id/details", async (req, res) => {
    const appointmentId = req.params.appointment_id;
    const scope = req.query.scope === "archived" ? "archived" : "active";

    try {
        const user = await getUserById(req.auth.user_id);

        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }

        const details = await loadAppointmentDetails(user, appointmentId, scope);

        if (!details) {
            return res.status(404).json({ error: "Appointment not found" });
        }

        logEvent("info", "appointment_details_loaded", {
            appointment_id: appointmentId,
            user_id: req.auth.user_id,
            role: user.role,
            scope,
            records: details.records.length
        });
        res.json(details);
    } catch (err) {
        logEvent("error", "appointment_details_failed", {
            appointment_id: appointmentId,
            user_id: req.auth.user_id,
            scope,
            error: err.message
        });
        res.status(500).json({ error: "Failed to load appointment details" });
    }
});

router.get("/records/export/me", requireRole("patient"), async (req, res) => {
    try {
        const user = await getUserById(req.auth.user_id);

        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }

        const activeAppointments = await loadAppointmentsForUser(user, "active");
        const archivedAppointments = await loadAppointmentsForUser(user, "archived");
        const records = await getAllRows(
            `SELECT record_id, patient_id, doctor_id, notes, created_at
             FROM records
             WHERE patient_id = ?
             ORDER BY created_at DESC`,
            [user.user_id],
            "records"
        );

        try {
            await writeAuditLog("patient_record_exported", req.auth.email, req.auth.user_id);
        } catch (auditErr) {
            logEvent("warn", "patient_record_export_audit_log_failed", {
                user_id: req.auth.user_id,
                error: auditErr.message
            });
        }

        res.json({
            exported_at: new Date().toISOString(),
            patient: {
                user_id: user.user_id,
                name: user.name,
                email: user.email
            },
            appointments: {
                active: activeAppointments,
                archived: archivedAppointments
            },
            records
        });
    } catch (err) {
        logEvent("error", "patient_record_export_failed", {
            user_id: req.auth.user_id,
            error: err.message
        });
        res.status(500).json({ error: "Failed to export records" });
    }
});

module.exports = router;
