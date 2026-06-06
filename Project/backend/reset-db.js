const fs = require("fs");
const { dbPath, logsDbPath, appLogPath } = require("./paths");

for (const targetPath of [dbPath, logsDbPath, appLogPath]) {
    try {
        if (fs.existsSync(targetPath)) {
            fs.unlinkSync(targetPath);
            console.log(`Deleted ${targetPath}`);
        }
    } catch (err) {
        if (targetPath === appLogPath) {
            console.warn(`Skipped deleting locked app log at ${targetPath}`);
            continue;
        }

        console.error(`Failed to delete ${targetPath}`, err);
        process.exitCode = 1;
    }
}
