const path = require("path");
const sqlite3 = require("sqlite3").verbose();

const dbPath = process.env.DB_PATH || path.join(__dirname, "elghealth.db");
const logsDbPath = process.env.LOGS_DB_PATH || path.join(__dirname, "logs.db");
const db = new sqlite3.Database(dbPath);
const logsDb = new sqlite3.Database(logsDbPath);

logsDb.serialize(() => {
    logsDb.run(`
        CREATE TABLE IF NOT EXISTS audit_logs (
            log_id INTEGER PRIMARY KEY AUTOINCREMENT,
            event_type TEXT NOT NULL,
            user_email TEXT NOT NULL,
            user_id INTEGER,
            event_time TEXT NOT NULL
        )
    `);
});

module.exports = { db, logsDb };
