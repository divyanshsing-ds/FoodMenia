const mongoose = require("mongoose");

const operatorSchema = new mongoose.Schema(
    {
        fullName: { type: String, required: true, trim: true },
        email: { type: String, required: true, unique: true, lowercase: true, trim: true },
        password: { type: String, required: true },
        role: { type: String, default: "operator", enum: ["operator"] },
        restaurantName: { type: String, required: true, trim: true },
        restaurantLocation: { type: String, required: true, trim: true },
    },
    { timestamps: true }
);

module.exports = mongoose.model("Operator", operatorSchema);
