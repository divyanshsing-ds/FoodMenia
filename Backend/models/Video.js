const mongoose = require("mongoose");

const videoSchema = new mongoose.Schema(
    {
        title: { type: String, required: true, trim: true },
        description: { type: String, trim: true },
        videoUrl: { type: String, required: true },
        thumbnailUrl: { type: String },
        creatorId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Creator",
            required: true,
        },
        restaurantId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Operator",
            required: true,
        },
        likedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
        views: { type: Number, default: 0 },
        comments: [
            {
                userId: { type: mongoose.Schema.Types.ObjectId },
                userName: { type: String },
                text: { type: String, required: true },
                likedBy: [{ type: mongoose.Schema.Types.ObjectId }],
                replies: [
                    {
                        userId: { type: mongoose.Schema.Types.ObjectId },
                        userName: { type: String },
                        text: { type: String, required: true },
                        createdAt: { type: Date, default: Date.now },
                    }
                ],
                createdAt: { type: Date, default: Date.now },
            },
        ],
    },
    { timestamps: true }
);

module.exports = mongoose.model("Video", videoSchema);
