const mongoose = require("mongoose");

const creatorSchema = new mongoose.Schema(
    {
        fullName: { type: String, required: true, trim: true },
        email: { type: String, required: true, unique: true, lowercase: true, trim: true },
        password: { type: String, required: true },
        role: { type: String, default: "creator", enum: ["creator"] },
        creatorBio: { type: String, default: "" },
    },
    { timestamps: true }
);

module.exports = mongoose.model("Creator", creatorSchema);
