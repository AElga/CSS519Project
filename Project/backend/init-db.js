const fs = require("fs");
const path = require("path");
const sqlite3 = require("sqlite3").verbose();
const { dbPath } = require("./paths");
const schemaPath = path.join(__dirname, "schema.sql");

const schema = fs.readFileSync(schemaPath, "utf8");
const db = new sqlite3.Database(dbPath);

db.exec(schema, (err) => {
    if (err) {
        console.error("Failed to initialize database schema", err);
        process.exit(1);
    }

    console.log(`Schema ensured for SQLite database at ${dbPath}`);
    db.close((closeErr) => {
        if (closeErr) {
            console.error("Failed to close initialized database", closeErr);
            process.exit(1);
        }

        process.exit(0);
    });
});
