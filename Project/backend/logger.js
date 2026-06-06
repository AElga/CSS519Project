const fs = require("fs");
const path = require("path");
const { appLogPath } = require("./paths");
const { recordAppLogEvent } = require("./metrics");

fs.mkdirSync(path.dirname(appLogPath), { recursive: true });

function logEvent(level, event, details = {}) {
    const entry = {
        timestamp: new Date().toISOString(),
        level,
        event,
        ...details
    };

    fs.appendFileSync(appLogPath, `${JSON.stringify(entry)}\n`);
    console.log(JSON.stringify(entry));
    recordAppLogEvent(level, event);
}

module.exports = {
    logEvent
};
