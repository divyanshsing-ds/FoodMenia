const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
    {
        fullName: { type: String, required: true, trim: true },
        email: { type: String, required: true, unique: true, lowercase: true, trim: true },
        password: { type: String, required: true },
        role: { type: String, default: "user", enum: ["user"] },
        following: [{ type: mongoose.Schema.Types.ObjectId, ref: "Creator" }],
        phone: { type: String, default: "" },
        address: { type: String, default: "" },

        // ── Student Discount ──────────────────────────────────
        studentStatus: {
            type: String,
            enum: ["none", "pending", "verified", "rejected"],
            default: "none",
        },
        studentIdImage: { type: String, default: "" },       // uploaded image path
        institutionName: { type: String, default: "" },      // parsed from ID
        idExpiryDate: { type: Date, default: null },         // parsed expiry
        studentVerifiedAt: { type: Date, default: null },    // when last verified
    },
    { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);
