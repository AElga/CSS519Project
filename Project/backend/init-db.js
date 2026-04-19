const fs = require("fs");
const path = require("path");
const sqlite3 = require("sqlite3").verbose();

const dbPath = process.env.DB_PATH || path.join(__dirname, "elghealth.db");
const schemaPath = path.join(__dirname, "schema.sql");

if (fs.existsSync(dbPath)) {
    console.log(`Using existing SQLite database at ${dbPath}`);
    process.exit(0);
}

const schema = fs.readFileSync(schemaPath, "utf8");
const db = new sqlite3.Database(dbPath);

db.exec(schema, (err) => {
    if (err) {
        console.error("Failed to initialize database schema", err);
        process.exit(1);
    }

    console.log(`Initialized SQLite database at ${dbPath}`);
    db.close((closeErr) => {
        if (closeErr) {
            console.error("Failed to close initialized database", closeErr);
            process.exit(1);
        }

        process.exit(0);
    });
});
