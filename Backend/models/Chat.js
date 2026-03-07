const mongoose = require("mongoose");

// ─── Sub-schema: individual message ──────────────────────────────────────────
const messageSchema = new mongoose.Schema(
    {
        senderId: {
            type: mongoose.Schema.Types.ObjectId,
            required: true,
        },
        senderRole: {
            type: String,
            enum: ["operator", "creator"],
            required: true,
        },
        senderName: { type: String, required: true },
        text: { type: String, required: true, trim: true },

        // If this message is an offer, these fields are populated
        isOffer: { type: Boolean, default: false },
        offerAmount: { type: Number, default: null },
        offerStatus: {
            type: String,
            enum: ["pending", "accepted", "rejected", "negotiating"],
            default: "pending",
        },
    },
    { timestamps: true }
);

// ─── Main Chat schema ─────────────────────────────────────────────────────────
const chatSchema = new mongoose.Schema(
    {
        operatorId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Operator",
            required: true,
        },
        operatorName: { type: String, required: true },

        creatorId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Creator",
            required: true,
        },
        creatorName: { type: String, required: true },

        // Overall collaboration offer status for this chat thread
        offerStatus: {
            type: String,
            enum: ["none", "pending", "accepted", "rejected", "negotiating"],
            default: "none",
        },
        // Latest offer amount in ₹
        latestOfferAmount: { type: Number, default: null },

        messages: [messageSchema],

        // Track unread counts for quick badge display
        unreadByCreator: { type: Number, default: 0 },
        unreadByOperator: { type: Number, default: 0 },
    },
    { timestamps: true }
);

// ─── Ensure one chat thread per operator-creator pair ────────────────
chatSchema.index({ operatorId: 1, creatorId: 1 }, { unique: true });

module.exports = mongoose.model("Chat", chatSchema);
