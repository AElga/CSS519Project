CREATE TABLE users (
    user_id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    email TEXT UNIQUE,
    password_hash TEXT,
    role TEXT
);

CREATE TABLE appointments (
    appointment_id INTEGER PRIMARY KEY AUTOINCREMENT,
    patient_id INTEGER,
    doctor_id INTEGER,
    appointment_time TEXT,
    status TEXT,
    FOREIGN KEY(patient_id) REFERENCES users(user_id),
    FOREIGN KEY(doctor_id) REFERENCES users(user_id)
);

CREATE TABLE records (
    record_id INTEGER PRIMARY KEY AUTOINCREMENT,
    patient_id INTEGER,
    doctor_id INTEGER,
    notes TEXT,
    created_at TEXT
);