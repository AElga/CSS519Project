const express = require("express");
const { db } = require("../db");

const router = express.Router();

router.post("/", (req, res) => {

    const { patient_id, doctor_id, appointment_time } = req.body;

    db.run(
        `INSERT INTO appointments(patient_id,doctor_id,appointment_time,status)
         VALUES(?,?,?,?)`,
        [patient_id, doctor_id, appointment_time, "scheduled"],
        function(err) {

            if (err) {
                return res.status(400).json(err);
            }

            res.json({ appointment_id: this.lastID });
        }
    );
});

router.get("/:user_id", (req, res) => {

    const userId = req.params.user_id;

    db.all(
        `SELECT * FROM appointments 
         WHERE patient_id=? OR doctor_id=?`,
        [userId, userId],
        (err, rows) => {
            res.json(rows);
        }
    );
});

module.exports = router;
