const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET || "MYFOOD";

// Middleware to verify JWT token
function authMiddleware(req, res, next) {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ success: false, message: "Access denied. No token provided." });
    }

    const token = authHeader.split(" ")[1];

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded; // { id, email, role, fullName }
        console.log(`✅ Auth success: ${decoded.email} (${decoded.role})`);
        next();
    } catch (err) {
        console.error(`❌ Auth failed: ${err.message}`);
        return res.status(401).json({ success: false, message: "Invalid or expired token." });
    }
}

// Middleware to check specific roles
function roleMiddleware(...roles) {
    return (req, res, next) => {
        if (!req.user || !roles.includes(req.user.role)) {
            return res.status(403).json({ success: false, message: "Access denied. Insufficient permissions." });
        }
        next();
    };
}

module.exports = { authMiddleware, roleMiddleware, JWT_SECRET };
