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
        orderId: { type: mongoose.Schema.Types.ObjectId, ref: "Order" }, // Track which order this rating belongs to
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

    // ── Best Seller Tracking ──────────────────────────────
    orderCount: { type: Number, default: 0 },       // total units ever ordered
    isBestSeller: { type: Boolean, default: false }, // set by weekly recalculation
    bestSellerUpdatedAt: { type: Date, default: null }, // last time badge was refreshed
  },
  { timestamps: true },
);

// Calculate average rating before saving
menuItemSchema.pre("save", async function () {
  // Always recalculate average rating if ratings array is present.
  if (this.ratings && this.ratings.length > 0) {
    let total = 0;
    this.ratings.forEach(r => {
      total += (Number(r.rating) || 0);
    });
    // Calculate average and round to 1 decimal place (e.g., 4.3)
    const avg = total / this.ratings.length;
    this.averageRating = Math.round(avg * 10) / 10;
  } else {
    this.averageRating = 0;
  }
});

module.exports = mongoose.model("MenuItem", menuItemSchema);
