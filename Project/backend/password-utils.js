const crypto = require("crypto");

const ITERATIONS = 120000;
const KEY_LENGTH = 64;
const DIGEST = "sha512";

function deriveKey(password, salt) {
    return new Promise((resolve, reject) => {
        crypto.pbkdf2(password, salt, ITERATIONS, KEY_LENGTH, DIGEST, (err, derivedKey) => {
            if (err) {
                reject(err);
                return;
            }

            resolve(derivedKey);
        });
    });
}

async function hashPassword(password) {
    const salt = crypto.randomBytes(16).toString("hex");
    const derivedKey = await deriveKey(password, salt);

    return `pbkdf2$${DIGEST}$${ITERATIONS}$${salt}$${derivedKey.toString("hex")}`;
}

async function verifyPassword(password, storedHash) {
    if (!storedHash || typeof storedHash !== "string") {
        return false;
    }

    const segments = storedHash.split("$");

    if (segments.length !== 5 || segments[0] !== "pbkdf2") {
        return false;
    }

    const [, digest, iterationsRaw, salt, expectedHex] = segments;
    const iterations = Number(iterationsRaw);

    if (!Number.isFinite(iterations) || !salt || !expectedHex) {
        return false;
    }

    const actual = await new Promise((resolve, reject) => {
        crypto.pbkdf2(password, salt, iterations, expectedHex.length / 2, digest, (err, derivedKey) => {
            if (err) {
                reject(err);
                return;
            }

            resolve(derivedKey);
        });
    });

    const expected = Buffer.from(expectedHex, "hex");

    if (expected.length !== actual.length) {
        return false;
    }

    return crypto.timingSafeEqual(expected, actual);
}

module.exports = {
    hashPassword,
    verifyPassword
};
