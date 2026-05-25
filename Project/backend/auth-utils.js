const jwt = require("jsonwebtoken");

const DEFAULT_DEV_SECRET = "dev-only-insecure-secret";

function getJwtSecret() {
    return process.env.JWT_SECRET || DEFAULT_DEV_SECRET;
}

function signAuthToken(user) {
    return jwt.sign(
        {
            sub: String(user.user_id),
            role: user.role,
            email: user.email
        },
        getJwtSecret(),
        { expiresIn: "1h" }
    );
}

function authenticateRequest(req, res, next) {
    const authorization = req.headers.authorization || "";

    if (!authorization.startsWith("Bearer ")) {
        return res.status(401).json({ error: "Authentication required" });
    }

    const token = authorization.slice("Bearer ".length);

    try {
        const payload = jwt.verify(token, getJwtSecret());
        req.auth = {
            user_id: Number(payload.sub),
            role: payload.role,
            email: payload.email
        };
        next();
    } catch {
        return res.status(401).json({ error: "Invalid or expired token" });
    }
}

function requireRole(role) {
    return (req, res, next) => {
        if (!req.auth || req.auth.role !== role) {
            return res.status(403).json({ error: "Forbidden" });
        }

        next();
    };
}

module.exports = {
    authenticateRequest,
    requireRole,
    signAuthToken,
    getJwtSecret
};
