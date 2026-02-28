const mongoose = require("mongoose");

const menuItemSchema = new mongoose.Schema(
  {
    operatorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Operator",
      required: true,
    },
    restaurantName: { type: String, required: true, trim: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, default: "", trim: true },
    price: { type: Number, required: true, min: 0 },
    category: { type: String, default: "General", trim: true },
    image: { type: String, default: "" }, // file path or URL
    restaurantImage: { type: String, default: "" }, // Restaurant banner image
    available: { type: Boolean, default: true },
    foodType: {
      type: String,
      enum: ["veg", "non-veg", "both"],
      default: "both",
    },
    ratings: [
      {
        userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        userName: { type: String, default: "Anonymous" },
        rating: { type: Number, min: 1, max: 5 },
        comment: { type: String, default: "" },
        likes: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
        replies: [
          {
            userId: { type: mongoose.Schema.Types.ObjectId },
            userName: { type: String },
            text: { type: String },
            createdAt: { type: Date, default: Date.now },
          },
        ],
        createdAt: { type: Date, default: Date.now },
      },
    ],
    averageRating: { type: Number, default: 0 },
  },
  { timestamps: true },
);

// Calculate average rating before saving
menuItemSchema.pre("save", async function () {
  if (this.ratings && this.ratings.length > 0) {
    const sum = this.ratings.reduce((acc, r) => acc + r.rating, 0);
    this.averageRating = Math.round((sum / this.ratings.length) * 10) / 10;
  } else {
    this.averageRating = 0;
  }
});

module.exports = mongoose.model("MenuItem", menuItemSchema);
