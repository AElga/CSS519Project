const path = require("path");
const bcrypt = require("bcrypt");
const sqlite3 = require("sqlite3").verbose();

const dbPath = process.env.DB_PATH || path.join(__dirname, "elghealth.db");
const db = new sqlite3.Database(dbPath);

const sampleUsers = [
    {
        name: "Test Patient",
        email: "patient@example.com",
        password: "Password123!",
        role: "patient"
    },
    {
        name: "Dr. Smith",
        email: "doctor@example.com",
        password: "Password123!",
        role: "doctor"
    }
];

const sampleAppointments = [
    {
        patientEmail: "patient@example.com",
        doctorEmail: "doctor@example.com",
        appointmentTime: "2026-05-01T10:00:00",
        status: "scheduled"
    }
];

const sampleRecords = [
    {
        patientEmail: "patient@example.com",
        doctorEmail: "doctor@example.com",
        notes: "CBC lab review: hemoglobin normal, follow-up as needed.",
        createdAt: "2026-04-26T09:00:00"
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

async function upsertUser(user) {
    const passwordHash = await bcrypt.hash(user.password, 10);

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
        const usersByRole = {};
        const usersByEmail = {};

        for (const user of sampleUsers) {
            const savedUser = await upsertUser(user);
            usersByRole[user.role] = savedUser;
            usersByEmail[user.email] = savedUser;
        }

        for (const appointment of sampleAppointments) {
            await ensureAppointment(appointment, usersByEmail);
        }

        for (const record of sampleRecords) {
            await ensureRecord(record, usersByEmail);
        }

        console.log("Seed complete.");
        console.log("Patient login: patient@example.com / Password123!");
        console.log("Doctor login: doctor@example.com / Password123!");
        console.log(`Patient ID: ${usersByRole.patient.user_id}`);
        console.log(`Doctor ID: ${usersByRole.doctor.user_id}`);
    } catch (err) {
        console.error("Seeding failed:", err);
        process.exitCode = 1;
    } finally {
        await closeDb();
    }
}

main();
