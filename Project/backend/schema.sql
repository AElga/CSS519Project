CREATE TABLE IF NOT EXISTS users (
    user_id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    email TEXT UNIQUE,
    password_hash TEXT,
    role TEXT
);

CREATE TABLE IF NOT EXISTS appointments (
    appointment_id INTEGER PRIMARY KEY AUTOINCREMENT,
    patient_id INTEGER,
    doctor_id INTEGER,
    appointment_time TEXT,
    status TEXT,
    FOREIGN KEY(patient_id) REFERENCES users(user_id),
    FOREIGN KEY(doctor_id) REFERENCES users(user_id)
);

CREATE TABLE IF NOT EXISTS archived_appointments (
    archived_appointment_id INTEGER PRIMARY KEY AUTOINCREMENT,
    original_appointment_id INTEGER,
    patient_id INTEGER,
    doctor_id INTEGER,
    appointment_time TEXT,
    status TEXT,
    archived_at TEXT,
    FOREIGN KEY(patient_id) REFERENCES users(user_id),
    FOREIGN KEY(doctor_id) REFERENCES users(user_id)
);

CREATE TABLE IF NOT EXISTS records (
    record_id INTEGER PRIMARY KEY AUTOINCREMENT,
    patient_id INTEGER,
    doctor_id INTEGER,
    notes TEXT,
    created_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_appointments_patient_doctor_time
    ON appointments(patient_id, doctor_id, appointment_time);

CREATE INDEX IF NOT EXISTS idx_archived_appointments_patient_doctor_time
    ON archived_appointments(patient_id, doctor_id, appointment_time);

CREATE INDEX IF NOT EXISTS idx_records_patient_doctor_time
    ON records(patient_id, doctor_id, created_at);
