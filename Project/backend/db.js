const sqlite3 = require("sqlite3").verbose();
const { dbPath, logsDbPath } = require("./paths");
const { recordDbOperation } = require("./metrics");

const db = new sqlite3.Database(dbPath);
const logsDb = new sqlite3.Database(logsDbPath);

function inferMetadata(sql, fallbackTable) {
    const compactSql = sql.replace(/\s+/g, " ").trim().toUpperCase();
    const tableMatch = compactSql.match(/\b(?:FROM|INTO|UPDATE)\s+([A-Z_]+)/);
    const operation = compactSql.split(" ")[0].toLowerCase();

    return {
        operation,
        table: (fallbackTable || (tableMatch ? tableMatch[1].toLowerCase() : "unknown"))
    };
}

function runTracked(database, sql, params = [], options = {}, callback) {
    const startedAt = process.hrtime.bigint();
    const metadata = inferMetadata(sql, options.table);

    database.run(sql, params, function onRun(err) {
        const durationSeconds = Number(process.hrtime.bigint() - startedAt) / 1e9;
        recordDbOperation(metadata.operation, metadata.table, err ? "error" : "success", durationSeconds);
        callback.call(this, err);
    });
}

function getTracked(database, sql, params = [], options = {}, callback) {
    const startedAt = process.hrtime.bigint();
    const metadata = inferMetadata(sql, options.table);

    database.get(sql, params, (err, row) => {
        const durationSeconds = Number(process.hrtime.bigint() - startedAt) / 1e9;
        recordDbOperation(metadata.operation, metadata.table, err ? "error" : "success", durationSeconds);
        callback(err, row);
    });
}

function allTracked(database, sql, params = [], options = {}, callback) {
    const startedAt = process.hrtime.bigint();
    const metadata = inferMetadata(sql, options.table);

    database.all(sql, params, (err, rows) => {
        const durationSeconds = Number(process.hrtime.bigint() - startedAt) / 1e9;
        recordDbOperation(metadata.operation, metadata.table, err ? "error" : "success", durationSeconds);
        callback(err, rows);
    });
}

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

module.exports = {
    db,
    logsDb,
    runTracked,
    getTracked,
    allTracked
};
