const app = require("./app");
const { db, logsDb } = require("./db");

function getFromDb(database, sql, params = []) {
    return new Promise((resolve, reject) => {
        database.get(sql, params, (err, row) => {
            if (err) {
                reject(err);
                return;
            }

            resolve(row);
        });
    });
}

function closeDb(database) {
    return new Promise((resolve, reject) => {
        database.close((err) => {
            if (err) {
                reject(err);
                return;
            }

            resolve();
        });
    });
}

async function postJson(url, body) {
    const response = await fetch(url, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(body)
    });

    const rawBody = await response.text();
    let payload = rawBody;

    if (rawBody) {
        try {
            payload = JSON.parse(rawBody);
        } catch {
            payload = rawBody;
        }
    }

    return { response, payload };
}

async function runSecurityTests() {
    const seededUser = await getFromDb(
        db,
        "SELECT user_id, email FROM users WHERE email = ?",
        ["patient@example.com"]
    );

    if (!seededUser) {
        throw new Error(
            "Missing seeded patient user. Run `npm run seed` before `npm run security_test`."
        );
    }

    const initialLogCountRow = await getFromDb(
        logsDb,
        "SELECT COUNT(*) AS count FROM audit_logs WHERE user_email = ? AND event_type = ?",
        [seededUser.email, "login_success"]
    );

    const server = app.listen(0);

    try {
        await new Promise((resolve, reject) => {
            server.once("listening", resolve);
            server.once("error", reject);
        });

        const { port } = server.address();
        const baseUrl = `http://127.0.0.1:${port}`;

        console.log("Running S-2: Invalid Login");

        const invalidLogin = await postJson(`${baseUrl}/auth/login`, {
            email: seededUser.email,
            password: "wrong"
        });

        if (invalidLogin.response.status !== 401) {
            throw new Error(
                `S-2 failed: expected 401, got ${invalidLogin.response.status}`
            );
        }

        console.log("S-2 passed");

        console.log("Running R-1: Audit Logging");

        const validLogin = await postJson(`${baseUrl}/auth/login`, {
            email: seededUser.email,
            password: "Password123!"
        });

        if (validLogin.response.status !== 200) {
            throw new Error(
                `R-1 setup failed: expected 200 login, got ${validLogin.response.status}`
            );
        }

        const latestAuditLog = await getFromDb(
            logsDb,
            `SELECT log_id, user_email, event_time
             FROM audit_logs
             WHERE user_email = ? AND event_type = ?
             ORDER BY log_id DESC
             LIMIT 1`,
            [seededUser.email, "login_success"]
        );

        const updatedLogCountRow = await getFromDb(
            logsDb,
            "SELECT COUNT(*) AS count FROM audit_logs WHERE user_email = ? AND event_type = ?",
            [seededUser.email, "login_success"]
        );

        if (!latestAuditLog) {
            throw new Error("R-1 failed: no audit log entry was created.");
        }

        if (updatedLogCountRow.count <= initialLogCountRow.count) {
            throw new Error("R-1 failed: audit log count did not increase.");
        }

        if (!latestAuditLog.event_time) {
            throw new Error("R-1 failed: audit log is missing its timestamp.");
        }

        console.log("R-1 passed");
        console.log("All security tests passed");
    } finally {
        await new Promise((resolve, reject) => {
            server.close((err) => {
                if (err) {
                    reject(err);
                    return;
                }

                resolve();
            });
        });

        await closeDb(db);
        await closeDb(logsDb);
    }
}

runSecurityTests().catch((err) => {
    console.error(err.message);
    process.exit(1);
});
