const fs = require("fs");
const os = require("os");
const path = require("path");

const localDataDir = path.join(os.tmpdir(), "elghealth-prototype");

function ensureDir(targetPath) {
    fs.mkdirSync(targetPath, { recursive: true });
}

function getDataPath(fileName) {
    ensureDir(localDataDir);
    return path.join(localDataDir, fileName);
}

module.exports = {
    dbPath: process.env.DB_PATH || getDataPath("elghealth.db"),
    logsDbPath: process.env.LOGS_DB_PATH || getDataPath("logs.db")
};
