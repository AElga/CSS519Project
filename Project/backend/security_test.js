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

async function runTest(name, testFn, failures) {
    console.log(`Running ${name}`);

    try {
        await testFn();
        console.log(`${name.split(":")[0]} passed`);
    } catch (err) {
        console.error(err.message);
        failures.push(err.message);
    }
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
    const failures = [];

    try {
        await new Promise((resolve, reject) => {
            server.once("listening", resolve);
            server.once("error", reject);
        });

        const { port } = server.address();
        const baseUrl = `http://127.0.0.1:${port}`;
        let validLoginSession;

        await runTest("S-2: Invalid Login", async () => {
            const invalidLogin = await postJson(`${baseUrl}/auth/login`, {
                email: seededUser.email,
                password: "wrong"
            });

            if (invalidLogin.response.status !== 401) {
                throw new Error(
                    `S-2 failed: expected 401, got ${invalidLogin.response.status}`
                );
            }
        }, failures);

        await runTest("R-1: Audit Logging", async () => {
            validLoginSession = await postJson(`${baseUrl}/auth/login`, {
                email: seededUser.email,
                password: "Password123!"
            });

            if (validLoginSession.response.status !== 200) {
                throw new Error(
                    `R-1 setup failed: expected 200 login, got ${validLoginSession.response.status}`
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
        }, failures);

        await runTest("S-8: Login Response Does Not Expose Password Hash", async () => {
            if (!validLoginSession || validLoginSession.response.status !== 200) {
                throw new Error("S-8 setup failed: valid login response was not available.");
            }

            if (!validLoginSession.payload.token) {
                throw new Error("S-8 failed: login response did not include an auth token.");
            }

            if (!validLoginSession.payload.user) {
                throw new Error("S-8 failed: login response did not include user details.");
            }

            if (Object.prototype.hasOwnProperty.call(validLoginSession.payload.user, "password_hash")) {
                throw new Error("S-8 failed: login response exposed password_hash.");
            }
        }, failures);

        await runTest("R-3: Failed Login Does Not Log Success", async () => {
            const beforeFailedLoginLogCount = await getFromDb(
                logsDb,
                "SELECT COUNT(*) AS count FROM audit_logs WHERE user_email = ? AND event_type = ?",
                [seededUser.email, "login_success"]
            );

            const failedLogin = await postJson(`${baseUrl}/auth/login`, {
                email: seededUser.email,
                password: "definitely-wrong"
            });

            if (failedLogin.response.status !== 401) {
                throw new Error(
                    `R-3 setup failed: expected 401, got ${failedLogin.response.status}`
                );
            }

            const afterFailedLoginLogCount = await getFromDb(
                logsDb,
                "SELECT COUNT(*) AS count FROM audit_logs WHERE user_email = ? AND event_type = ?",
                [seededUser.email, "login_success"]
            );

            if (afterFailedLoginLogCount.count !== beforeFailedLoginLogCount.count) {
                throw new Error("R-3 failed: failed login changed success audit log count.");
            }
        }, failures);

        if (failures.length > 0) {
            throw new Error(
                `Security tests failed:\n${failures.map((failure) => `- ${failure}`).join("\n")}`
            );
        }

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
