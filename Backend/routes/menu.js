const express = require("express");
const router = express.Router();
const MenuItem = require("../models/MenuItem");
const { authMiddleware, roleMiddleware } = require("../middleware/auth");
const upload = require("../middleware/upload");
const fs = require("fs");
const path = require("path");


// =====================================================
//  GET ALL AVAILABLE MENU ITEMS (Public)
//  /api/menu
// =====================================================
router.get("/", async (req, res) => {
  try {
    const items = await MenuItem.find({ available: true })
      .sort({ createdAt: -1 });

    res.json({ success: true, data: items });
  } catch (err) {
    res.status(500).json({ success: false });
  }
});


// GET operator menu
router.get("/my", authMiddleware, roleMiddleware("operator"), async (req, res) => {
  try {
    const items = await MenuItem.find({ operatorId: req.user.id })
      .sort({ createdAt: -1 });

    res.json({ success: true, data: items });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// CREATE menu item
router.post("/", authMiddleware, roleMiddleware("operator"), upload.single("image"), async (req, res) => {
  try {
    const { name, description, price, category, foodType } = req.body;

    const newItem = await MenuItem.create({
      operatorId: req.user.id,
      restaurantName: req.user.restaurantName || "My Restaurant", // fallback for demo
      name,
      description: description || "",
      price: Number(price) || 0,
      category: category || "General",
      foodType: foodType || "both",
      image: req.file ? `/uploads/${req.file.filename}` : "",
    });

    res.json({ success: true, data: newItem });
  } catch (err) {
    console.error("🔥 Critical Create Error:", err);
    res.status(500).json({ success: false, message: "Server error while adding item", error: err.message });
  }
});

// UPDATE menu item
router.put("/:id", authMiddleware, roleMiddleware("operator"), upload.single("image"), async (req, res) => {
  const { id } = req.params;

  try {
    const item = await MenuItem.findById(id);

    if (!item) {
      return res.status(404).json({ success: false, message: "Item not found" });
    }

    // Ownership Check
    if (item.operatorId.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: "Unauthorized: You do not own this item" });
    }

    const { name, description, price, category, foodType } = req.body;

    // Apply basic field updates
    if (name) item.name = name;
    if (description !== undefined) item.description = description;
    if (price) item.price = Number(price);
    if (category) item.category = category;
    if (foodType) item.foodType = foodType;

    // Apply image update if a new file was uploaded
    if (req.file) {
      if (item.image) {
        const oldPath = path.join(__dirname, "..", item.image);
        if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
      }
      item.image = `/uploads/${req.file.filename}`;
    }

    await item.save();

    res.json({
      success: true,
      message: "Menu item updated successfully",
      data: item
    });
  } catch (err) {
    console.error("🔥 Critical Update Error:", {
      message: err.message,
      name: err.name,
      stack: err.stack,
      body: req.body,
      params: req.params
    });
    res.status(500).json({
      success: false,
      message: "Server error while updating item",
      error: err.message
    });
  }
});

// DELETE item
router.delete("/:id", authMiddleware, roleMiddleware("operator"), async (req, res) => {
  try {
    const item = await MenuItem.findById(req.params.id);

    if (!item) {
      return res.status(404).json({ success: false });
    }

    if (item.operatorId.toString() !== req.user.id) {
      return res.status(403).json({ success: false });
    }

    if (item.image) {
      const imagePath = path.join(__dirname, "..", item.image);
      if (fs.existsSync(imagePath)) fs.unlinkSync(imagePath);
    }

    await item.deleteOne();

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false });
  }
});

// RATE menu item
router.post("/:id/rate", authMiddleware, async (req, res) => {
  try {
    const { rating, comment, orderId } = req.body;
    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ success: false, message: "Rating must be 1-5" });
    }

    if (!orderId) {
      return res.status(400).json({ success: false, message: "orderId is required" });
    }

    const item = await MenuItem.findById(req.params.id);
    if (!item) return res.status(404).json({ success: false, message: "Item not found" });

    const Order = require("../models/Order");
    const orderVerified = await Order.findOne({
      _id: orderId,
      userId: req.user.id,
      status: "delivered",
      "items.menuItemId": req.params.id
    });

    if (!orderVerified) {
      return res.status(403).json({ success: false, message: "You can only rate items you've bought in a delivered order!" });
    }

    // Now uniquely find by BOTH userId and orderId. 
    // This allows one distinct rating PER ORDER.
    const existingIdx = item.ratings.findIndex(r =>
      r.userId?.toString() === req.user.id &&
      r.orderId?.toString() === orderId
    );

    if (existingIdx > -1) {
      // Update existing rating for THIS specific order
      item.ratings[existingIdx].rating = rating;
      item.ratings[existingIdx].comment = comment || "";
      item.ratings[existingIdx].userName = req.user.fullName || "Anonymous";
    } else {
      // Add new rating for this new order
      item.ratings.push({
        userId: req.user.id,
        orderId: orderId,
        userName: req.user.fullName || "Anonymous",
        rating,
        comment: comment || ""
      });
    }

    item.markModified("ratings");
    await item.save();
    res.json({ success: true, data: item });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// LIKE a rating
router.post("/:id/rate/:ratingId/like", authMiddleware, async (req, res) => {
  try {
    const item = await MenuItem.findById(req.params.id);
    if (!item) return res.status(404).json({ success: false, message: "Item not found" });

    const rating = item.ratings.id(req.params.ratingId);
    if (!rating) return res.status(404).json({ success: false, message: "Rating not found" });

    const userId = req.user.id;
    const index = rating.likes.indexOf(userId);

    if (index === -1) {
      rating.likes.push(userId);
    } else {
      rating.likes.splice(index, 1);
    }

    item.markModified("ratings");
    await item.save();
    res.json({ success: true, data: item });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// REPLY to a rating
router.post("/:id/rate/:ratingId/reply", authMiddleware, async (req, res) => {
  try {
    const { text } = req.body;
    if (!text) return res.status(400).json({ success: false, message: "Reply text is required" });

    const item = await MenuItem.findById(req.params.id);
    if (!item) return res.status(404).json({ success: false, message: "Item not found" });

    const rating = item.ratings.id(req.params.ratingId);
    if (!rating) return res.status(404).json({ success: false, message: "Rating not found" });

    rating.replies.push({
      userId: req.user.id,
      userName: req.user.fullName || "Operator",
      text,
      createdAt: new Date()
    });

    item.markModified("ratings");
    await item.save();
    res.json({ success: true, data: item });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// RECALCULATE BEST SELLERS  (operator only, max once per 7 days per restaurant)
// POST /api/menu/recalculate-best-sellers
router.post("/recalculate-best-sellers", authMiddleware, roleMiddleware("operator"), async (req, res) => {
  try {
    const operatorId = req.user.id;
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    // Throttle: check if already recalculated in the last 7 days
    const lastRun = await MenuItem.findOne({
      operatorId,
      bestSellerUpdatedAt: { $gt: sevenDaysAgo },
    });

    if (lastRun) {
      return res.json({
        success: false,
        message: `Best Seller badges were last updated on ${lastRun.bestSellerUpdatedAt.toLocaleDateString()}. Next update available in 7 days.`,
      });
    }

    // Fetch all items for this operator
    const items = await MenuItem.find({ operatorId });

    if (items.length === 0) {
      return res.json({ success: false, message: "No menu items found." });
    }

    // Sort by orderCount descending
    const sorted = [...items].sort((a, b) => b.orderCount - a.orderCount);

    // Top 20% qualify as Best Sellers (minimum 5 orders to prevent gaming)
    const threshold = Math.max(5, Math.ceil(sorted.length * 0.2));
    const topItems = sorted.slice(0, threshold);

    const topIds = new Set(topItems.filter(i => i.orderCount >= 5).map(i => i._id.toString()));

    let badgesAdded = 0;
    for (const item of items) {
      const shouldBeBestSeller = topIds.has(item._id.toString());
      if (item.isBestSeller !== shouldBeBestSeller) {
        item.isBestSeller = shouldBeBestSeller;
        if (shouldBeBestSeller) badgesAdded++;
      }
      item.bestSellerUpdatedAt = new Date();
      await item.save();
    }

    console.log(`🏆 Best Seller recalculated for operator ${operatorId}: ${badgesAdded} new badges.`);
    res.json({ success: true, message: `Best Seller badges updated! ${badgesAdded} items marked.` });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Use a simple middleware at the end for router-level 404s
router.use((req, res) => {
  res.status(404).json({ success: false, message: `No route matching ${req.method} ${req.url} in Menu Router` });
});

module.exports = router;
