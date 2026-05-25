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

async function requestJson(url, options = {}) {
    const response = await fetch(url, options);
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

async function login(baseUrl, email, password) {
    return requestJson(`${baseUrl}/auth/login`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({ email, password })
    });
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

async function runComplianceTests() {
    const patient = await getFromDb(
        db,
        "SELECT user_id, email FROM users WHERE email = ?",
        ["patient@example.com"]
    );
    const patientTwo = await getFromDb(
        db,
        "SELECT user_id, email FROM users WHERE email = ?",
        ["patient2@example.com"]
    );
    const doctor = await getFromDb(
        db,
        "SELECT user_id, email FROM users WHERE email = ?",
        ["doctor@example.com"]
    );

    if (!patient || !patientTwo || !doctor) {
        throw new Error("Missing seeded users. Run `npm run seed` before `npm run compliance_test`.");
    }

    const server = app.listen(0);
    const failures = [];

    try {
        await new Promise((resolve, reject) => {
            server.once("listening", resolve);
            server.once("error", reject);
        });

        const { port } = server.address();
        const baseUrl = `http://127.0.0.1:${port}`;
        const patientSession = await login(baseUrl, patient.email, "Password123!");
        const patientTwoSession = await login(baseUrl, patientTwo.email, "Password123!");
        const doctorSession = await login(baseUrl, doctor.email, "Password123!");

        if (!patientSession.payload.token || !patientTwoSession.payload.token || !doctorSession.payload.token) {
            throw new Error("Could not create authenticated sessions for compliance tests.");
        }

        await runTest("C-1: Appointment APIs reject unauthenticated access", async () => {
            const result = await requestJson(`${baseUrl}/appointments/user/${patient.user_id}?scope=active`);

            if (result.response.status !== 401) {
                throw new Error(`C-1 failed: expected 401, got ${result.response.status}`);
            }
        }, failures);

        await runTest("C-2: Users cannot access another patient's appointments", async () => {
            const result = await requestJson(
                `${baseUrl}/appointments/user/${patient.user_id}?scope=active`,
                {
                    headers: {
                        Authorization: `Bearer ${patientTwoSession.payload.token}`
                    }
                }
            );

            if (result.response.status !== 403) {
                throw new Error(`C-2 failed: expected 403, got ${result.response.status}`);
            }
        }, failures);

        await runTest("C-3: Patients can export their own records", async () => {
            const result = await requestJson(`${baseUrl}/appointments/records/export/me`, {
                headers: {
                    Authorization: `Bearer ${patientSession.payload.token}`
                }
            });

            if (result.response.status !== 200) {
                throw new Error(`C-3 failed: expected 200, got ${result.response.status}`);
            }

            if (!result.payload.patient || result.payload.patient.user_id !== patient.user_id) {
                throw new Error("C-3 failed: export payload did not contain the authenticated patient.");
            }

            if (!Array.isArray(result.payload.records) || result.payload.records.length === 0) {
                throw new Error("C-3 failed: export payload did not include records.");
            }
        }, failures);

        await runTest("C-4: Doctors cannot use the patient export endpoint", async () => {
            const result = await requestJson(`${baseUrl}/appointments/records/export/me`, {
                headers: {
                    Authorization: `Bearer ${doctorSession.payload.token}`
                }
            });

            if (result.response.status !== 403) {
                throw new Error(`C-4 failed: expected 403, got ${result.response.status}`);
            }
        }, failures);

        await runTest("C-5: Appointment details minimize unnecessary PII", async () => {
            const appointments = await requestJson(
                `${baseUrl}/appointments/user/${patient.user_id}?scope=active`,
                {
                    headers: {
                        Authorization: `Bearer ${patientSession.payload.token}`
                    }
                }
            );

            if (appointments.response.status !== 200 || !Array.isArray(appointments.payload) || appointments.payload.length === 0) {
                throw new Error("C-5 setup failed: could not load appointments for patient.");
            }

            const detailResult = await requestJson(
                `${baseUrl}/appointments/${appointments.payload[0].appointment_id}/details?scope=active`,
                {
                    headers: {
                        Authorization: `Bearer ${patientSession.payload.token}`
                    }
                }
            );

            if (detailResult.response.status !== 200) {
                throw new Error(`C-5 setup failed: expected 200, got ${detailResult.response.status}`);
            }

            const appointment = detailResult.payload.appointment || {};

            if (Object.prototype.hasOwnProperty.call(appointment, "patient_email")
                || Object.prototype.hasOwnProperty.call(appointment, "doctor_email")) {
                throw new Error("C-5 failed: appointment details exposed unnecessary email fields.");
            }
        }, failures);

        if (failures.length > 0) {
            throw new Error(
                `Compliance tests failed:\n${failures.map((failure) => `- ${failure}`).join("\n")}`
            );
        }

        console.log("All compliance tests passed");
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

runComplianceTests().catch((err) => {
    console.error(err.message);
    process.exit(1);
});
