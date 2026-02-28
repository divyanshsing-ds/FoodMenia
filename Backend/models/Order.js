const mongoose = require("mongoose");

const orderSchema = new mongoose.Schema(
    {
        userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
        userName: { type: String, required: true },
        userEmail: { type: String, required: true },
        operatorId: { type: mongoose.Schema.Types.ObjectId, ref: "Operator", required: true },
        restaurantName: { type: String, required: true },
        items: [
            {
                menuItemId: { type: mongoose.Schema.Types.ObjectId, ref: "MenuItem" },
                name: { type: String, required: true },
                price: { type: Number, required: true },
                quantity: { type: Number, required: true, min: 1 },
                image: { type: String, default: "" },
            },
        ],
        totalAmount: { type: Number, required: true },

        // ── Order flow ──────────────────────────────────────
        status: {
            type: String,
            default: "pending",
            enum: [
                "pending", "confirmed", "preparing",
                "out_for_delivery", "delivered",
                "rejected", "cancelled", "cancel_requested",
            ],
        },

        // ── Payment ──────────────────────────────────────────
        paymentMethod: {
            type: String,
            enum: ["cod", "upi"],
            required: true,
        },
        paymentStatus: {
            type: String,
            enum: ["pending", "paid", "refunded"],
            default: "pending",
        },

        // ── Delivery OTP ─────────────────────────────────────
        deliveryOTP: { type: String, default: null },

        // ── Reasons ──────────────────────────────────────────
        rejectionReason: { type: String, default: "" },
        cancellationReason: { type: String, default: "" },
    },
    { timestamps: true }
);

module.exports = mongoose.model("Order", orderSchema);
