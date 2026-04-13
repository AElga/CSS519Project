const API = window.location.protocol === "file:"
    ? "http://localhost:3000"
    : window.location.origin + "/api";

let currentUser = null;

async function login() {

    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;

    const res = await fetch(API + "/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
    });

    const user = await res.json();

    currentUser = user;

    localStorage.setItem("user", JSON.stringify(user));

    window.location = "dashboard.html";
}

async function schedule() {

    const doctor = document.getElementById("doctor").value;
    const time = document.getElementById("time").value;

    const user = JSON.parse(localStorage.getItem("user"));

    await fetch(API + "/appointments", {
        method: "POST",
        headers: {"Content-Type":"application/json"},
        body: JSON.stringify({
            patient_id: user.user_id,
            doctor_id: doctor,
            appointment_time: time
        })
    });

    loadAppointments();
}

async function loadAppointments() {

    const user = JSON.parse(localStorage.getItem("user"));

    const res = await fetch(API + "/appointments/" + user.user_id);

    const data = await res.json();

    const list = document.getElementById("appointments");

    list.innerHTML = "";

    data.forEach(a => {

        const li = document.createElement("li");

        li.innerText = `${a.appointment_time} (status: ${a.status})`;

        list.appendChild(li);
    });
}

window.onload = loadAppointments;
