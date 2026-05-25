const API = window.location.protocol === "file:"
    ? "http://localhost:3000"
    : `${window.location.origin}/api`;

let currentUser = null;
let currentAppointments = {
    active: [],
    archived: []
};
let currentTab = "active";
let selectedAppointment = {
    appointmentId: null,
    scope: "active"
};

function getStoredUser() {
    const raw = sessionStorage.getItem("session");
    return raw ? JSON.parse(raw) : null;
}

function setStoredUser(session) {
    currentUser = session;
    sessionStorage.setItem("session", JSON.stringify(session));
}

function clearStoredUser() {
    currentUser = null;
    sessionStorage.removeItem("session");
}

function getAuthHeaders(extraHeaders = {}) {
    const session = getStoredUser();
    const headers = { ...extraHeaders };

    if (session && session.token) {
        headers.Authorization = `Bearer ${session.token}`;
    }

    return headers;
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

function formatRole(role) {
    return role === "doctor" ? "Doctor" : "Patient";
}

function formatAppointmentTime(value) {
    if (!value) {
        return "Time not set";
    }

    const parsed = new Date(value);

    if (Number.isNaN(parsed.getTime())) {
        return value;
    }

    return parsed.toLocaleString([], {
        dateStyle: "medium",
        timeStyle: "short"
    });
}

function getRoleDescriptor(user) {
    if (!user) {
        return "";
    }

    return user.role === "doctor"
        ? "Review each patient visit and related clinical notes."
        : "Review your upcoming visits and the notes tied to your care.";
}

function getEmptyTabMessage(scope) {
    if (scope === "archived") {
        return "No archived appointments are available yet.";
    }

    return currentUser && currentUser.user.role === "doctor"
        ? "No active patient appointments are assigned to you yet."
        : "You do not have any active appointments yet.";
}

async function login() {
    const emailInput = document.getElementById("email");
    const passwordInput = document.getElementById("password");
    const errorElement = document.getElementById("login-error");
    const email = emailInput.value.trim();
    const password = passwordInput.value;

    if (errorElement) {
        errorElement.textContent = "";
    }

    await postUiEvent("login", "submit_clicked", { email });

    const res = await fetch(`${API}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
    });

    if (!res.ok) {
        const errorText = await res.text();
        await postUiEvent("login", "login_failed", { email, status: res.status });

        if (errorElement) {
            errorElement.textContent = errorText;
        }

        return;
    }

    const session = await res.json();
    setStoredUser(session);

    await postUiEvent("login", "login_success", { email, role: session.user.role });
    window.location = "dashboard.html";
}

async function schedule() {
    const doctorInput = document.getElementById("doctor");
    const timeInput = document.getElementById("time");
    const feedbackElement = document.getElementById("schedule-feedback");
    const session = getStoredUser();
    const user = session ? session.user : null;

    if (!user || user.role !== "patient") {
        return;
    }

    const doctor = doctorInput.value.trim();
    const time = timeInput.value;

    if (feedbackElement) {
        feedbackElement.textContent = "";
    }

    await postUiEvent("dashboard", "schedule_clicked", {
        patient_id: user.user_id,
        doctor_id: doctor
    });

    const response = await fetch(`${API}/appointments`, {
        method: "POST",
        headers: getAuthHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({
            patient_id: user.user_id,
            doctor_id: doctor,
            appointment_time: time
        })
    });

    if (!response.ok) {
        const errorText = await response.text();
        await postUiEvent("dashboard", "schedule_failed", { status: response.status });

        if (feedbackElement) {
            feedbackElement.textContent = errorText;
        }

        return;
    }

    doctorInput.value = "";
    timeInput.value = "";

    if (feedbackElement) {
        feedbackElement.textContent = "Appointment request saved.";
    }

    await postUiEvent("dashboard", "schedule_success", {
        doctor_id: doctor,
        appointment_time: time
    });

    await loadAppointments();
}

async function fetchAppointments(scope) {
    const session = getStoredUser();
    const user = session ? session.user : null;

    if (!user) {
        return [];
    }

    const res = await fetch(`${API}/appointments/user/${user.user_id}?scope=${scope}`, {
        headers: getAuthHeaders()
    });

    if (!res.ok) {
        throw new Error(`Failed to load ${scope} appointments`);
    }

    return res.json();
}

async function loadAppointments() {
    const [activeAppointments, archivedAppointments] = await Promise.all([
        fetchAppointments("active"),
        fetchAppointments("archived")
    ]);

    currentAppointments = {
        active: activeAppointments,
        archived: archivedAppointments
    };

    renderTabCounts();

    const appointmentsForTab = currentAppointments[currentTab];
    const selectedStillExists = appointmentsForTab.some((appointment) =>
        appointment.appointment_id === selectedAppointment.appointmentId
        && currentTab === selectedAppointment.scope
    );

    renderAppointments();

    if (appointmentsForTab.length === 0) {
        selectedAppointment = {
            appointmentId: null,
            scope: currentTab
        };
        renderAppointmentDetails(null);
        return;
    }

    const nextAppointmentId = selectedStillExists
        ? selectedAppointment.appointmentId
        : appointmentsForTab[0].appointment_id;

    await selectAppointment(nextAppointmentId, currentTab, false);
}

function renderTabCounts() {
    const activeCount = document.getElementById("tab-count-active");
    const archivedCount = document.getElementById("tab-count-archived");

    if (activeCount) {
        activeCount.textContent = currentAppointments.active.length;
    }

    if (archivedCount) {
        archivedCount.textContent = currentAppointments.archived.length;
    }
}

function renderAppointments() {
    const list = document.getElementById("appointments");
    const emptyState = document.getElementById("appointments-empty");
    const activeTabButton = document.getElementById("tab-active");
    const archivedTabButton = document.getElementById("tab-archived");

    if (!list) {
        return;
    }

    if (activeTabButton) {
        activeTabButton.classList.toggle("is-active", currentTab === "active");
    }

    if (archivedTabButton) {
        archivedTabButton.classList.toggle("is-active", currentTab === "archived");
    }

    list.innerHTML = "";

    const appointments = currentAppointments[currentTab];

    if (appointments.length === 0) {
        if (emptyState) {
            emptyState.hidden = false;
            emptyState.textContent = getEmptyTabMessage(currentTab);
        }

        return;
    }

    if (emptyState) {
        emptyState.hidden = true;
    }

    appointments.forEach((appointment) => {
        const button = document.createElement("button");
        const counterpartLabel = currentUser.user.role === "doctor"
            ? `Patient: ${appointment.patient_name}`
            : `Doctor: ${appointment.doctor_name}`;

        button.className = "appointment-card";
        if (
            appointment.appointment_id === selectedAppointment.appointmentId
            && currentTab === selectedAppointment.scope
        ) {
            button.classList.add("is-selected");
        }

        button.type = "button";
        button.innerHTML = `
            <span class="appointment-card__time">${formatAppointmentTime(appointment.appointment_time)}</span>
            <span class="appointment-card__person">${counterpartLabel}</span>
            <span class="appointment-card__status">Status: ${appointment.status}</span>
        `;
        button.addEventListener("click", () => {
            selectAppointment(appointment.appointment_id, currentTab, true);
        });

        list.appendChild(button);
    });
}

async function selectAppointment(appointmentId, scope, shouldTrack = true) {
    const session = getStoredUser();
    const user = session ? session.user : null;

    if (!user || !appointmentId) {
        return;
    }

    selectedAppointment = {
        appointmentId,
        scope
    };
    renderAppointments();

    if (shouldTrack) {
        await postUiEvent("dashboard", "appointment_selected", {
            appointment_id: appointmentId,
            user_id: user.user_id,
            role: user.role,
            scope
        });
    }

    const res = await fetch(
        `${API}/appointments/${appointmentId}/details?scope=${scope}`,
        {
            headers: getAuthHeaders()
        }
    );

    if (!res.ok) {
        throw new Error("Failed to load appointment details");
    }

    const details = await res.json();
    renderAppointmentDetails(details);
}

function renderAppointmentDetails(details) {
    const emptyState = document.getElementById("details-empty");
    const content = document.getElementById("appointment-details");
    const recordsList = document.getElementById("records-list");

    if (!content || !recordsList) {
        return;
    }

    if (!details) {
        content.hidden = true;
        if (emptyState) {
            emptyState.hidden = false;
        }
        return;
    }

    const { appointment, records } = details;

    if (emptyState) {
        emptyState.hidden = true;
    }

    content.hidden = false;

    document.getElementById("details-title").textContent =
        `${formatAppointmentTime(appointment.appointment_time)}`;
    document.getElementById("details-status").textContent =
        `Status: ${appointment.status}`;
    document.getElementById("details-source").textContent =
        appointment.source === "archived" ? "Archived appointment" : "Active appointment";
    document.getElementById("details-patient").textContent =
        `${appointment.patient_name}`;
    document.getElementById("details-doctor").textContent =
        `${appointment.doctor_name}`;

    recordsList.innerHTML = "";

    if (records.length === 0) {
        const emptyRecord = document.createElement("div");
        emptyRecord.className = "record-card record-card--empty";
        emptyRecord.textContent = "No lab results or notes have been attached to this care relationship yet.";
        recordsList.appendChild(emptyRecord);
        return;
    }

    records.forEach((record) => {
        const item = document.createElement("article");
        item.className = "record-card";
        item.innerHTML = `
            <p class="record-card__meta">${formatAppointmentTime(record.created_at)}</p>
            <p class="record-card__body">${record.notes}</p>
        `;
        recordsList.appendChild(item);
    });
}

function switchAppointmentsTab(scope) {
    currentTab = scope;
    renderAppointments();

    const appointments = currentAppointments[scope];

    if (appointments.length === 0) {
        selectedAppointment = {
            appointmentId: null,
            scope
        };
        renderAppointmentDetails(null);
        return;
    }

    selectAppointment(appointments[0].appointment_id, scope, false);
}

function hydrateDashboardShell() {
    const session = getStoredUser();
    const user = session ? session.user : null;

    if (!user) {
        window.location = "login.html";
        return;
    }

    const nameElement = document.getElementById("user-name");
    const roleElement = document.getElementById("user-role");
    const subtitleElement = document.getElementById("dashboard-subtitle");
    const schedulePanel = document.getElementById("schedule-panel");
    const appointmentHeading = document.getElementById("appointments-heading");

    if (nameElement) {
        nameElement.textContent = user.name;
    }

    if (roleElement) {
        roleElement.textContent = formatRole(user.role);
    }

    if (subtitleElement) {
        subtitleElement.textContent = getRoleDescriptor(user);
    }

    if (appointmentHeading) {
        appointmentHeading.textContent = user.role === "doctor"
            ? "Your patient appointments"
            : "Your appointments";
    }

    if (schedulePanel) {
        schedulePanel.hidden = user.role !== "patient";
    }

    const exportButton = document.getElementById("export-records-button");
    if (exportButton) {
        exportButton.hidden = user.role !== "patient";
    }
}

async function initializeDashboard() {
    hydrateDashboardShell();

    try {
        await loadAppointments();
    } catch (err) {
        const emptyState = document.getElementById("details-empty");

        if (emptyState) {
            emptyState.hidden = false;
            emptyState.textContent = "We could not load appointment data right now.";
        }

        console.error(err);
    }
}

function logout() {
    clearStoredUser();
    window.location = "login.html";
}

async function exportRecords() {
    const feedbackElement = document.getElementById("export-feedback");

    if (feedbackElement) {
        feedbackElement.textContent = "";
    }

    const response = await fetch(`${API}/appointments/records/export/me`, {
        headers: getAuthHeaders()
    });

    if (!response.ok) {
        if (feedbackElement) {
            feedbackElement.textContent = "We could not export your records right now.";
        }
        return;
    }

    const payload = await response.json();
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const downloadUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = downloadUrl;
    link.download = "elghealth-record-export.json";
    link.click();
    URL.revokeObjectURL(downloadUrl);

    if (feedbackElement) {
        feedbackElement.textContent = "Your record export has been downloaded.";
    }
}

window.login = login;
window.schedule = schedule;
window.logout = logout;
window.switchAppointmentsTab = switchAppointmentsTab;
window.exportRecords = exportRecords;

window.addEventListener("load", async () => {
    const page = window.location.pathname.split("/").pop() || "index.html";
    currentUser = getStoredUser();

    await postUiEvent("page", "page_view", {
        page,
        user_role: currentUser ? currentUser.user.role : "guest"
    });

    if (page === "dashboard.html") {
        await initializeDashboard();
    }
});
