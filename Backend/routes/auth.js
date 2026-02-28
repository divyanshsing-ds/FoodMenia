const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const router = express.Router();
const { JWT_SECRET } = require("../middleware/auth");

// ---------- Models ----------
const User = require("../models/User");
const Creator = require("../models/Creator");
const Operator = require("../models/Operator");

// Helper: pick the right model based on role
function getModel(role) {
    switch (role) {
        case "creator": return Creator;
        case "operator": return Operator;
        default: return User;
    }
}

// ========================================================
//  POST  /api/auth/signup
// ========================================================
router.post("/signup", async (req, res) => {
    try {
        const { role = "user", fullName, email, password, creatorBio, restaurantName, restaurantLocation } = req.body;

        // --- basic validation ---
        if (!fullName || !email || !password) {
            return res.status(400).json({ success: false, message: "Full name, email and password are required." });
        }

        if (role === "creator" && !creatorBio) {
            return res.status(400).json({ success: false, message: "Creator bio is required for creators." });
        }

        if (role === "operator" && (!restaurantName || !restaurantLocation)) {
            return res.status(400).json({ success: false, message: "Restaurant name and location are required for operators." });
        }

        const Model = getModel(role);

        // check if email already exists in this collection
        const existing = await Model.findOne({ email });
        if (existing) {
            return res.status(409).json({ success: false, message: "An account with this email already exists." });
        }

        // hash password
        const salt = await bcrypt.genSalt(10);
        const hashedPw = await bcrypt.hash(password, salt);

        // build document
        const doc = { fullName, email, password: hashedPw, role };
        if (role === "creator") doc.creatorBio = creatorBio;
        if (role === "operator") {
            doc.restaurantName = restaurantName;
            doc.restaurantLocation = restaurantLocation;
        }

        const newUser = await Model.create(doc);

        // Generate JWT token on signup too
        const tokenPayload = { id: newUser._id, fullName: newUser.fullName, email: newUser.email, role };
        if (role === "operator") tokenPayload.restaurantName = newUser.restaurantName;
        const token = jwt.sign(
            tokenPayload,
            JWT_SECRET,
            { expiresIn: "7d" }
        );

        return res.status(201).json({
            success: true,
            message: `${role.charAt(0).toUpperCase() + role.slice(1)} account created successfully!`,
            token,
            data: {
                id: newUser._id,
                fullName: newUser.fullName,
                email: newUser.email,
                role,
                ...(role === "operator" && { restaurantName: newUser.restaurantName, restaurantLocation: newUser.restaurantLocation }),
                ...(role === "creator" && { creatorBio: newUser.creatorBio }),
            },
        });
    } catch (err) {
        console.error("Signup error:", err);
        return res.status(500).json({ success: false, message: "Server error. Please try again later." });
    }
});

// ========================================================
//  POST  /api/auth/login
// ========================================================
router.post("/login", async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ success: false, message: "Email and password are required." });
        }

        // Search across all three collections
        let user = await User.findOne({ email });
        let role = "user";

        if (!user) {
            user = await Creator.findOne({ email });
            role = "creator";
        }
        if (!user) {
            user = await Operator.findOne({ email });
            role = "operator";
        }
        if (!user) {
            return res.status(401).json({ success: false, message: "Invalid email or password." });
        }

        // compare password
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ success: false, message: "Invalid email or password." });
        }

        // Generate JWT token
        const tokenPayload = { id: user._id, fullName: user.fullName, email: user.email, role };
        if (role === "operator") tokenPayload.restaurantName = user.restaurantName;
        const token = jwt.sign(
            tokenPayload,
            JWT_SECRET,
            { expiresIn: "7d" }
        );

        return res.status(200).json({
            success: true,
            message: "Login successful!",
            token,
            data: {
                id: user._id,
                fullName: user.fullName,
                email: user.email,
                role,
                ...(role === "operator" && { restaurantName: user.restaurantName, restaurantLocation: user.restaurantLocation }),
                ...(role === "creator" && { creatorBio: user.creatorBio }),
            },
        });
    } catch (err) {
        console.error("Login error:", err);
        return res.status(500).json({ success: false, message: "Server error. Please try again later." });
    }
});

// ========================================================
//  GET  /api/auth/operators
// ========================================================
router.get("/operators", async (req, res) => {
    try {
        const operators = await Operator.find({}, "restaurantName _id");
        res.json({ success: true, data: operators });
    } catch (err) {
        res.status(500).json({ success: false, message: "Server error" });
    }
});

// ========================================================
//  GET  /api/auth/verify
// ========================================================
const { authMiddleware } = require("../middleware/auth");
router.get("/verify", authMiddleware, (req, res) => {
    res.json({ success: true, user: req.user });
});

// ========================================================
//  PATCH /api/auth/profile
// ========================================================
router.patch("/profile", authMiddleware, async (req, res) => {
    try {
        const { creatorBio } = req.body;
        const role = req.user.role;

        if (role !== "creator") {
            return res.status(403).json({ success: false, message: "Only creators can update bio." });
        }

        const updated = await Creator.findByIdAndUpdate(
            req.user.id,
            { creatorBio },
            { new: true }
        );

        if (!updated) {
            return res.status(404).json({ success: false, message: "Creator not found." });
        }

        res.json({
            success: true,
            message: "Profile updated!",
            data: {
                id: updated._id,
                fullName: updated.fullName,
                email: updated.email,
                role: updated.role,
                creatorBio: updated.creatorBio
            }
        });
    } catch (err) {
        console.error("Profile update error:", err);
        res.status(500).json({ success: false, message: "Server error" });
    }
});

module.exports = router;
