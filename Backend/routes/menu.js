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
router.post("/", (req, res, next) => {
  console.log("📨 Incoming POST /api/menu request");
  next();
}, authMiddleware, roleMiddleware("operator"), (req, res, next) => {
  console.log("🔑 Auth passed for /api/menu");
  next();
}, upload.single("image"), async (req, res) => {
  console.log("📁 File upload passed, creating MenuItem");
  try {
    const { name, description, price, category } = req.body;

    const newItem = await MenuItem.create({
      operatorId: req.user.id,
      restaurantName: req.user.restaurantName,
      name,
      description,
      price,
      category,
      image: req.file ? `/uploads/${req.file.filename}` : "",
    });

    res.json({ success: true, data: newItem });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// UPDATE menu item
router.put("/:id", authMiddleware, roleMiddleware("operator"), upload.single("image"), async (req, res) => {
  const { id } = req.params;
  console.log(`\n🔄 [UPDATE REQUEST] Item ID: ${id}`);
  console.log(`👤 Operator: ${req.user.email} (${req.user.id})`);
  console.log(`📦 Fields Received: ${Object.keys(req.body).join(", ")}`);
  console.log(`🖼️ File Received: ${req.file ? req.file.filename : "NONE"}`);

  try {
    const item = await MenuItem.findById(id);

    if (!item) {
      console.log("❌ Error: Item not found in database.");
      return res.status(404).json({ success: false, message: "Item not found" });
    }

    // Ownership Check
    if (item.operatorId.toString() !== req.user.id) {
      console.log(`🚫 Unauthorized: ID ${req.user.id} tried to edit item belonging to ${item.operatorId}`);
      return res.status(403).json({ success: false, message: "Unauthorized: You do not own this item" });
    }

    const { name, description, price, category } = req.body;

    // Apply basic field updates
    if (name) item.name = name;
    if (description !== undefined) item.description = description;
    if (price) item.price = Number(price);
    if (category) item.category = category;

    // Apply image update if a new file was uploaded
    if (req.file) {
      if (item.image) {
        const oldPath = path.join(__dirname, "..", item.image);
        if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
      }
      item.image = `/uploads/${req.file.filename}`;
      console.log(`✅ Image Successfully Replaced: -> [${item.image}]`);
    }

    await item.save();
    console.log("✨ Change persisted to database successfully.");

    res.json({
      success: true,
      message: "Menu item updated successfully",
      data: item
    });
  } catch (err) {
    console.error("🔥 Critical Update Error:", err.message);
    res.status(500).json({ success: false, message: "Server error while updating item" });
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
    const { rating, comment } = req.body;
    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ success: false, message: "Rating must be 1-5" });
    }

    const item = await MenuItem.findById(req.params.id);
    if (!item) return res.status(404).json({ success: false, message: "Item not found" });

    const Order = require("../models/Order");
    const hasOrdered = await Order.findOne({
      userId: req.user.id,
      status: "delivered",
      "items.menuItemId": req.params.id
    });

    if (!hasOrdered) {
      return res.status(403).json({ success: false, message: "You can only rate items you've bought!" });
    }

    const existingIdx = item.ratings.findIndex(r => r.userId.toString() === req.user.id);
    if (existingIdx > -1) {
      item.ratings[existingIdx].rating = rating;
      item.ratings[existingIdx].comment = comment || "";
      item.ratings[existingIdx].userName = req.user.fullName || "Anonymous";
    } else {
      item.ratings.push({
        userId: req.user.id,
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

// Use a simple middleware at the end for router-level 404s
router.use((req, res) => {
  console.log(`🔍 Menu Router: No match for ${req.method} ${req.url}`);
  res.status(404).json({ success: false, message: `No route matching ${req.method} ${req.url} in Menu Router` });
});

module.exports = router;
