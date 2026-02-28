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
        status: {
            type: String,
            default: "pending",
            enum: ["pending", "confirmed", "preparing", "out_for_delivery", "delivered", "rejected", "cancelled", "cancel_requested"],
        },
        rejectionReason: { type: String, default: "" },
        cancellationReason: { type: String, default: "" },
    },
    { timestamps: true }
);

module.exports = mongoose.model("Order", orderSchema);
