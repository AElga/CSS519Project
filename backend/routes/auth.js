const express = require("express");
const bcrypt = require("bcrypt");
const db = require("../db");

const router = express.Router();

router.post("/register", async (req, res) => {

    const { name, email, password, role } = req.body;

    const hash = await bcrypt.hash(password, 10);

    db.run(
        "INSERT INTO users(name,email,password_hash,role) VALUES (?,?,?,?)",
        [name, email, hash, role],
        function(err) {

            if (err) {
                return res.status(400).json(err);
            }

            res.json({ user_id: this.lastID });
        }
    );
});

router.post("/login", (req, res) => {

    const { email, password } = req.body;

    db.get(
        "SELECT * FROM users WHERE email=?",
        [email],
        async (err, user) => {

            if (!user) {
                return res.status(401).send("User not found");
            }

            const valid = await bcrypt.compare(password, user.password_hash);

            if (!valid) {
                return res.status(401).send("Invalid password");
            }

            res.json(user);
        }
    );
});

module.exports = router;