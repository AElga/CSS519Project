const backendBaseUrl = process.env.BACKEND_URL || "http://backend:3000";
const frontendBaseUrl = process.env.FRONTEND_URL || "http://frontend";
const baseIntervalMs = Number(process.env.SIM_INTERVAL_MS || 8000);
const userPairs = [
    {
        patientEmail: "patient@example.com",
        doctorEmail: "doctor@example.com"
    },
    {
        patientEmail: "patient2@example.com",
        doctorEmail: "doctor2@example.com"
    },
    {
        patientEmail: "patient3@example.com",
        doctorEmail: "doctor3@example.com"
    }
];

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function randomBetween(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function getTrafficProfile(date = new Date()) {
    const hour = date.getHours();

    if (hour >= 7 && hour < 10) {
        return {
            label: "morning_peak",
            multiplier: 0.45,
            cycles: 3
        };
    }

    if (hour >= 10 && hour < 16) {
        return {
            label: "midday_peak",
            multiplier: 0.6,
            cycles: 2
        };
    }

    if (hour >= 16 && hour < 20) {
        return {
            label: "evening_shoulder",
            multiplier: 0.9,
            cycles: 1
        };
    }

    if (hour >= 20 || hour < 6) {
        return {
            label: "overnight_lull",
            multiplier: 2.8,
            cycles: 1
        };
    }

    return {
        label: "early_morning",
        multiplier: 1.5,
        cycles: 1
    };
}

function getNextDelayMs() {
    const profile = getTrafficProfile();
    const jitter = randomBetween(300, 2500);

    return {
        profile,
        delayMs: Math.max(1500, Math.round(baseIntervalMs * profile.multiplier) + jitter)
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

async function loginUser(email, password) {
    const response = await postJson(`${backendBaseUrl}/auth/login`, {
        email,
        password
    });

    if (response.response.status !== 200) {
        throw new Error(`Expected successful login for ${email}, received ${response.response.status}: ${response.body}`);
    }

    return JSON.parse(response.body);
}

async function sendUiEvent(event, metadata = {}) {
    await postJson(`${backendBaseUrl}/observability/ui-event`, {
        surface: "traffic-simulator",
        event,
        metadata
    });
}

async function runCycle(cycle, profile) {
    const pair = userPairs[(cycle - 1) % userPairs.length];

    await sendUiEvent("cycle_started", {
        cycle,
        traffic_profile: profile.label
    });
    await fetch(`${frontendBaseUrl}/`);
    await fetch(`${frontendBaseUrl}/health`);

    await postJson(`${backendBaseUrl}/auth/login`, {
        email: pair.patientEmail,
        password: "wrong-password"
    });

    const patient = await loginUser(pair.patientEmail, "Password123!");
    const doctor = await loginUser(pair.doctorEmail, "Password123!");
    const activeAppointments = await fetch(
        `${backendBaseUrl}/appointments/user/${patient.user_id}?scope=active`
    ).then((response) => response.json());
    const matchingActiveAppointments = activeAppointments.filter(
        (appointment) => appointment.doctor_id === doctor.user_id
    );

    await sendUiEvent("dashboard_viewed", {
        cycle,
        user_id: patient.user_id,
        active_appointments: matchingActiveAppointments.length,
        traffic_profile: profile.label
    });

    if (matchingActiveAppointments.length < 3) {
        const appointmentTime = new Date(
            Date.now() + randomBetween(20, 240) * 60000
        ).toISOString();

        await postJson(`${backendBaseUrl}/appointments`, {
            patient_id: patient.user_id,
            doctor_id: doctor.user_id,
            appointment_time: appointmentTime
        });

        await sendUiEvent("simulated_appointment_created", {
            cycle,
            patient_id: patient.user_id,
            doctor_id: doctor.user_id,
            appointment_time: appointmentTime,
            traffic_profile: profile.label
        });
    } else {
        await sendUiEvent("appointment_cap_reached", {
            cycle,
            patient_id: patient.user_id,
            doctor_id: doctor.user_id,
            traffic_profile: profile.label
        });
    }

    await fetch(`${backendBaseUrl}/appointments/user/${patient.user_id}?scope=active`);
    await fetch(`${backendBaseUrl}/appointments/user/${patient.user_id}?scope=archived`);
    await fetch(`${backendBaseUrl}/observability/summary`);
    await fetch(`${backendBaseUrl}/metrics`);
    await fetch(`${backendBaseUrl}/health`);
    await sendUiEvent("cycle_completed", {
        cycle,
        patient_id: patient.user_id,
        doctor_id: doctor.user_id,
        traffic_profile: profile.label
    });
}

async function main() {
    await waitForService(`${backendBaseUrl}/health`, "backend");
    await waitForService(`${frontendBaseUrl}/health`, "frontend");

    let cycle = 1;

    while (true) {
        const { profile, delayMs } = getNextDelayMs();

        try {
            const cycleCount = profile.cycles;

            for (let index = 0; index < cycleCount; index += 1) {
                await runCycle(cycle, profile);
                console.log(`Traffic cycle ${cycle} complete (${profile.label})`);
                cycle += 1;
            }
        } catch (err) {
            console.error(`Traffic cycle ${cycle} failed: ${err.message}`);
            cycle += 1;
        }

        await sleep(delayMs);
    }
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
