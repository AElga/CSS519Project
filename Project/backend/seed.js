const fs = require("fs");
const path = require("path");
const sqlite3 = require("sqlite3").verbose();
const { dbPath } = require("./paths");
const { hashPassword } = require("./password-utils");

const schemaPath = path.join(__dirname, "schema.sql");
const db = new sqlite3.Database(dbPath);

const sampleUsers = [
    {
        name: "Avery Stone",
        email: "patient@example.com",
        password: "Password123!",
        role: "patient"
    },
    {
        name: "Jordan Miles",
        email: "patient2@example.com",
        password: "Password123!",
        role: "patient"
    },
    {
        name: "Priya Shah",
        email: "patient3@example.com",
        password: "Password123!",
        role: "patient"
    },
    {
        name: "Dr. Emma Smith",
        email: "doctor@example.com",
        password: "Password123!",
        role: "doctor"
    },
    {
        name: "Dr. Daniel Chen",
        email: "doctor2@example.com",
        password: "Password123!",
        role: "doctor"
    },
    {
        name: "Dr. Sofia Garcia",
        email: "doctor3@example.com",
        password: "Password123!",
        role: "doctor"
    }
];

const sampleAppointments = [
    {
        patientEmail: "patient@example.com",
        doctorEmail: "doctor@example.com",
        appointmentTime: "2026-05-24T09:00:00",
        status: "scheduled"
    },
    {
        patientEmail: "patient@example.com",
        doctorEmail: "doctor@example.com",
        appointmentTime: "2026-05-25T10:30:00",
        status: "scheduled"
    },
    {
        patientEmail: "patient2@example.com",
        doctorEmail: "doctor@example.com",
        appointmentTime: "2026-05-24T13:00:00",
        status: "scheduled"
    },
    {
        patientEmail: "patient2@example.com",
        doctorEmail: "doctor2@example.com",
        appointmentTime: "2026-05-26T15:00:00",
        status: "scheduled"
    },
    {
        patientEmail: "patient3@example.com",
        doctorEmail: "doctor3@example.com",
        appointmentTime: "2026-05-27T11:15:00",
        status: "scheduled"
    }
];

const sampleArchivedAppointments = [
    {
        patientEmail: "patient@example.com",
        doctorEmail: "doctor@example.com",
        appointmentTime: "2026-04-18T09:00:00",
        status: "completed",
        archivedAt: "2026-04-18T12:00:00"
    },
    {
        patientEmail: "patient2@example.com",
        doctorEmail: "doctor2@example.com",
        appointmentTime: "2026-04-10T15:00:00",
        status: "completed",
        archivedAt: "2026-04-10T17:15:00"
    },
    {
        patientEmail: "patient3@example.com",
        doctorEmail: "doctor3@example.com",
        appointmentTime: "2026-04-05T11:15:00",
        status: "completed",
        archivedAt: "2026-04-05T12:45:00"
    }
];

const sampleRecords = [
    {
        patientEmail: "patient@example.com",
        doctorEmail: "doctor@example.com",
        notes: "CBC lab review: hemoglobin normal, follow-up as needed.",
        createdAt: "2026-04-26T09:00:00"
    },
    {
        patientEmail: "patient2@example.com",
        doctorEmail: "doctor@example.com",
        notes: "Metabolic panel reviewed. Hydration guidance provided and repeat labs ordered in six weeks.",
        createdAt: "2026-04-24T11:00:00"
    },
    {
        patientEmail: "patient2@example.com",
        doctorEmail: "doctor2@example.com",
        notes: "X-ray follow-up: healing progressing as expected. Continue limited activity for two more weeks.",
        createdAt: "2026-04-20T16:00:00"
    },
    {
        patientEmail: "patient3@example.com",
        doctorEmail: "doctor3@example.com",
        notes: "Annual wellness visit complete. Cholesterol improved and no medication adjustments required.",
        createdAt: "2026-04-21T10:30:00"
    }
];

function run(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function onRun(err) {
            if (err) {
                reject(err);
                return;
            }

            resolve(this);
        });
    });
}

function get(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => {
            if (err) {
                reject(err);
                return;
            }

            resolve(row);
        });
    });
}

function closeDb() {
    return new Promise((resolve, reject) => {
        db.close((err) => {
            if (err) {
                reject(err);
                return;
            }

            resolve();
        });
    });
}

function exec(sql) {
    return new Promise((resolve, reject) => {
        db.exec(sql, (err) => {
            if (err) {
                reject(err);
                return;
            }

            resolve();
        });
    });
}

async function ensureSchema() {
    const schema = fs.readFileSync(schemaPath, "utf8");
    await exec(schema);
}

async function upsertUser(user) {
    const passwordHash = await hashPassword(user.password);

    await run(
        `INSERT INTO users(name, email, password_hash, role)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(email) DO UPDATE SET
             name = excluded.name,
             password_hash = excluded.password_hash,
             role = excluded.role`,
        [user.name, user.email, passwordHash, user.role]
    );

    return get(
        "SELECT user_id, name, email, role FROM users WHERE email = ?",
        [user.email]
    );
}

async function ensureAppointment(appointment, usersByEmail) {
    const patient = usersByEmail[appointment.patientEmail];
    const doctor = usersByEmail[appointment.doctorEmail];

    if (!patient || !doctor) {
        throw new Error(
            `Appointment references missing user(s): ${appointment.patientEmail}, ${appointment.doctorEmail}`
        );
    }

    const existing = await get(
        `SELECT appointment_id
         FROM appointments
         WHERE patient_id = ? AND doctor_id = ? AND appointment_time = ? AND status = ?`,
        [patient.user_id, doctor.user_id, appointment.appointmentTime, appointment.status]
    );

    if (!existing) {
        await run(
            `INSERT INTO appointments(patient_id, doctor_id, appointment_time, status)
             VALUES (?, ?, ?, ?)`,
            [patient.user_id, doctor.user_id, appointment.appointmentTime, appointment.status]
        );
    }
}

async function ensureArchivedAppointment(appointment, usersByEmail) {
    const patient = usersByEmail[appointment.patientEmail];
    const doctor = usersByEmail[appointment.doctorEmail];

    if (!patient || !doctor) {
        throw new Error(
            `Archived appointment references missing user(s): ${appointment.patientEmail}, ${appointment.doctorEmail}`
        );
    }

    const existing = await get(
        `SELECT archived_appointment_id
         FROM archived_appointments
         WHERE patient_id = ? AND doctor_id = ? AND appointment_time = ? AND status = ?`,
        [patient.user_id, doctor.user_id, appointment.appointmentTime, appointment.status]
    );

    if (!existing) {
        await run(
            `INSERT INTO archived_appointments(
                original_appointment_id,
                patient_id,
                doctor_id,
                appointment_time,
                status,
                archived_at
             ) VALUES (?, ?, ?, ?, ?, ?)`,
            [null, patient.user_id, doctor.user_id, appointment.appointmentTime, appointment.status, appointment.archivedAt]
        );
    }
}

async function ensureRecord(record, usersByEmail) {
    const patient = usersByEmail[record.patientEmail];
    const doctor = usersByEmail[record.doctorEmail];

    if (!patient || !doctor) {
        throw new Error(
            `Record references missing user(s): ${record.patientEmail}, ${record.doctorEmail}`
        );
    }

    const existing = await get(
        `SELECT record_id
         FROM records
         WHERE patient_id = ? AND doctor_id = ? AND notes = ? AND created_at = ?`,
        [patient.user_id, doctor.user_id, record.notes, record.createdAt]
    );

    if (!existing) {
        await run(
            `INSERT INTO records(patient_id, doctor_id, notes, created_at)
             VALUES (?, ?, ?, ?)`,
            [patient.user_id, doctor.user_id, record.notes, record.createdAt]
        );
    }
}

async function main() {
    try {
        await ensureSchema();
        console.log(`Schema ensured for SQLite database at ${dbPath}`);

        const usersByEmail = {};

        for (const user of sampleUsers) {
            const savedUser = await upsertUser(user);
            usersByEmail[user.email] = savedUser;
        }

        for (const appointment of sampleAppointments) {
            await ensureAppointment(appointment, usersByEmail);
        }

        for (const appointment of sampleArchivedAppointments) {
            await ensureArchivedAppointment(appointment, usersByEmail);
        }

        for (const record of sampleRecords) {
            await ensureRecord(record, usersByEmail);
        }

        console.log("Seed complete.");
        console.log("Mock accounts:");

        for (const user of sampleUsers) {
            console.log(`- ${user.role}: ${user.email} / ${user.password}`);
        }
    } catch (err) {
        console.error("Seeding failed:", err);
        process.exitCode = 1;
    } finally {
        await closeDb();
    }
}

main();
