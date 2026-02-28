const express = require("express");
const router = express.Router();
const Order = require("../models/Order");
const MenuItem = require("../models/MenuItem");
const { authMiddleware, roleMiddleware } = require("../middleware/auth");


// =====================================================
//  GET OPERATOR ORDERS
//  /api/orders/operator
// =====================================================
router.get("/operator", authMiddleware, roleMiddleware("operator"), async (req, res) => {
  try {
    const orders = await Order.find({ operatorId: req.user.id })
      .sort({ createdAt: -1 });

    res.json({ success: true, data: orders });
  } catch (err) {
    res.status(500).json({ success: false });
  }
});


// =====================================================
//  GET USER ORDERS
//  /api/orders/my
// =====================================================
router.get("/my", authMiddleware, roleMiddleware("user"), async (req, res) => {
  try {
    const orders = await Order.find({ userId: req.user.id })
      .sort({ createdAt: -1 });

    res.json({ success: true, data: orders });
  } catch (err) {
    res.status(500).json({ success: false });
  }
});


// =====================================================
//  CREATE ORDER
//  /api/orders
// =====================================================
router.post("/", authMiddleware, roleMiddleware("user"), async (req, res) => {
  try {
    const { operatorId, restaurantName, items } = req.body;

    if (!items || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No items provided",
      });
    }

    let total = 0;
    const formattedItems = [];

    for (let item of items) {
      const menuItem = await MenuItem.findById(item.menuItemId);

      if (!menuItem) continue;

      total += menuItem.price * item.quantity;

      formattedItems.push({
        menuItemId: menuItem._id,
        name: menuItem.name,
        price: menuItem.price,
        quantity: item.quantity,
        image: menuItem.image,
      });
    }

    const order = await Order.create({
      userId: req.user.id,
      userName: req.user.fullName,
      userEmail: req.user.email,
      operatorId,
      restaurantName,
      items: formattedItems,
      totalAmount: total,
      status: "pending",
    });

    res.json({ success: true, data: order });
  } catch (err) {
    res.status(500).json({ success: false });
  }
});


// =====================================================
//  UPDATE ORDER STATUS
//  /api/orders/:id/status
// =====================================================
router.put("/:id/status", authMiddleware, roleMiddleware("operator"), async (req, res) => {
  try {
    const { status, rejectionReason } = req.body;

    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({ success: false });
    }

    if (order.operatorId.toString() !== req.user.id) {
      return res.status(403).json({ success: false });
    }

    const validTransitions = {
      pending: ["confirmed", "rejected", "cancel_requested"],
      confirmed: ["preparing", "cancel_requested"],
      preparing: ["out_for_delivery"],
      out_for_delivery: ["delivered"],
      cancel_requested: ["cancelled", "confirmed", "preparing"],
    };

    if (
      order.status !== status &&
      !validTransitions[order.status]?.includes(status)
    ) {
      return res.status(400).json({
        success: false,
        message: `Invalid transition from ${order.status} to ${status}`,
      });
    }

    order.status = status;

    if (status === "rejected") {
      order.rejectionReason = rejectionReason || "";
    }

    if (status === "cancelled") {
      // If operator cancels it (approving user request or manual cancel)
      order.cancellationReason = rejectionReason || order.cancellationReason || "Cancelled by operator";
    }

    await order.save();

    res.json({ success: true, data: order });
  } catch (err) {
    res.status(500).json({ success: false });
  }
});

// =====================================================
//  CANCEL ORDER (User)
//  /api/orders/:id/cancel
// =====================================================
router.patch("/:id/cancel", authMiddleware, roleMiddleware("user"), async (req, res) => {
  try {
    const { reason } = req.body;
    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    if (order.userId.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: "Unauthorized" });
    }

    // Only allow cancellation if order is pending or confirmed
    if (!["pending", "confirmed"].includes(order.status)) {
      return res.status(400).json({
        success: false,
        message: `Cannot cancel order in ${order.status} state`,
      });
    }

    order.status = "cancel_requested";
    order.cancellationReason = reason || "User requested cancellation";
    await order.save();

    res.json({ success: true, data: order });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
