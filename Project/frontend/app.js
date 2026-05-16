const API = window.location.protocol === "file:"
    ? "http://localhost:3000"
    : `${window.location.origin}/api`;

let currentUser = null;

function getStoredUser() {
    const raw = localStorage.getItem("user");
    return raw ? JSON.parse(raw) : null;
}

async function postUiEvent(surface, event, metadata = {}) {
    try {
        await fetch(`${API}/observability/ui-event`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ surface, event, metadata })
        });
    } catch (err) {
        console.error("Failed to post UI event", err);
    }
}

function formatBytes(value) {
    if (!value && value !== 0) {
        return "-";
    }

    const units = ["B", "KB", "MB", "GB"];
    let current = value;
    let unitIndex = 0;

    while (current >= 1024 && unitIndex < units.length - 1) {
        current /= 1024;
        unitIndex += 1;
    }

    return `${current.toFixed(1)} ${units[unitIndex]}`;
}

async function login() {
    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;

    postUiEvent("login", "submit_clicked", { email });

    const res = await fetch(`${API}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
    });

    if (!res.ok) {
        const errorText = await res.text();
        postUiEvent("login", "login_failed", { email, status: res.status });
        alert(errorText);
        return;
    }

    const user = await res.json();

    currentUser = user;
    localStorage.setItem("user", JSON.stringify(user));

    postUiEvent("login", "login_success", { email, role: user.role });
    window.location = "dashboard.html";
}

async function schedule() {
    const doctor = document.getElementById("doctor").value;
    const time = document.getElementById("time").value;
    const user = getStoredUser();

    postUiEvent("dashboard", "schedule_clicked", {
        patient_id: user ? user.user_id : null,
        doctor_id: doctor
    });

    const response = await fetch(`${API}/appointments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            patient_id: user.user_id,
            doctor_id: doctor,
            appointment_time: time
        })
    });

    if (!response.ok) {
        const errorText = await response.text();
        postUiEvent("dashboard", "schedule_failed", { status: response.status });
        alert(errorText);
        return;
    }

    postUiEvent("dashboard", "schedule_success", { doctor_id: doctor, appointment_time: time });
    await Promise.all([loadAppointments(), loadSummary()]);
}

async function loadAppointments() {
    const user = getStoredUser();

    if (!user) {
        return;
    }

    const res = await fetch(`${API}/appointments/${user.user_id}`);
    const data = await res.json();
    const list = document.getElementById("appointments");

    if (!list) {
        return;
    }

    list.innerHTML = "";

    data.forEach((appointment) => {
        const li = document.createElement("li");
        li.innerText = `${appointment.appointment_time} (status: ${appointment.status})`;
        list.appendChild(li);
    });
}

async function loadSummary() {
    const container = document.getElementById("live-summary");

    if (!container) {
        return;
    }

    const response = await fetch(`${API}/observability/summary`);
    const summary = await response.json();

    container.innerHTML = `
        <li>Total API calls: ${summary.counters.http_requests_total}</li>
        <li>Appointments created: ${summary.counters.appointments_created_total}</li>
        <li>UI interactions: ${summary.counters.ui_interactions_total}</li>
        <li>DB operations: ${summary.counters.db_operations_total}</li>
        <li>Audit log rows: ${summary.rows.audit_logs}</li>
        <li>App log size: ${formatBytes(summary.storage.app_log_bytes)}</li>
        <li>Backend memory: ${formatBytes(summary.process.memory_rss_bytes)}</li>
        <li>Backend uptime: ${Math.round(summary.process.uptime_seconds)}s</li>
    `;
}

window.login = login;
window.schedule = schedule;

window.addEventListener("load", async () => {
    const page = window.location.pathname.split("/").pop() || "index.html";
    currentUser = getStoredUser();

    await postUiEvent("page", "page_view", { page });

    if (document.getElementById("appointments")) {
        await Promise.all([loadAppointments(), loadSummary()]);
        window.setInterval(loadSummary, 5000);
    }
});
