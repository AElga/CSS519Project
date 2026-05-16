const backendBaseUrl = process.env.BACKEND_URL || "http://backend:3000";
const frontendBaseUrl = process.env.FRONTEND_URL || "http://frontend";
const intervalMs = Number(process.env.SIM_INTERVAL_MS || 8000);

async function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchText(url, options) {
    const response = await fetch(url, options);
    return {
        response,
        text: await response.text()
    };
}

async function waitForService(url, label) {
    while (true) {
        try {
            const response = await fetch(url);

            if (response.ok) {
                console.log(`Connected to ${label} at ${url}`);
                return;
            }
        } catch (err) {
            console.log(`Waiting for ${label}: ${err.message}`);
        }

        await sleep(3000);
    }
}

async function postJson(url, payload) {
    const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
    });

    return {
        response,
        body: await response.text()
    };
}

async function sendUiEvent(event, metadata = {}) {
    await postJson(`${backendBaseUrl}/observability/ui-event`, {
        surface: "traffic-simulator",
        event,
        metadata
    });
}

async function runCycle(cycle) {
    await sendUiEvent("cycle_started", { cycle });
    await fetch(`${frontendBaseUrl}/`);
    await fetch(`${frontendBaseUrl}/health`);

    await postJson(`${backendBaseUrl}/auth/login`, {
        email: "patient@example.com",
        password: "wrong-password"
    });

    const login = await postJson(`${backendBaseUrl}/auth/login`, {
        email: "patient@example.com",
        password: "Password123!"
    });

    if (login.response.status !== 200) {
        throw new Error(`Expected successful login, received ${login.response.status}: ${login.body}`);
    }

    const user = JSON.parse(login.body);

    await sendUiEvent("dashboard_viewed", {
        cycle,
        user_id: user.user_id
    });

    const appointmentTime = new Date(Date.now() + cycle * 60000).toISOString();

    await postJson(`${backendBaseUrl}/appointments`, {
        patient_id: user.user_id,
        doctor_id: 2,
        appointment_time: appointmentTime
    });

    await fetch(`${backendBaseUrl}/appointments/${user.user_id}`);
    await fetch(`${backendBaseUrl}/observability/summary`);
    await fetch(`${backendBaseUrl}/metrics`);
    await fetch(`${backendBaseUrl}/health`);
    await sendUiEvent("cycle_completed", { cycle, appointment_time: appointmentTime });
}

async function main() {
    await waitForService(`${backendBaseUrl}/health`, "backend");
    await waitForService(`${frontendBaseUrl}/health`, "frontend");

    let cycle = 1;

    while (true) {
        try {
            await runCycle(cycle);
            console.log(`Traffic cycle ${cycle} complete`);
        } catch (err) {
            console.error(`Traffic cycle ${cycle} failed: ${err.message}`);
        }

        cycle += 1;
        await sleep(intervalMs);
    }
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
