const express = require("express");
const router = express.Router();
const Order = require("../models/Order");
const MenuItem = require("../models/MenuItem");
const Operator = require("../models/Operator");
const { authMiddleware, roleMiddleware } = require("../middleware/auth");

// ── Helper ────────────────────────────────────────────────
function generateOTP() {
  return String(Math.floor(1000 + Math.random() * 9000)); // 4-digit
}


// =====================================================
//  GET OPERATOR ORDERS   /api/orders/operator
// =====================================================
router.get("/operator", authMiddleware, roleMiddleware("operator"), async (req, res) => {
  try {
    const orders = await Order.find({ operatorId: req.user.id })
      .select("-deliveryOTP") // Security: hide customer OTP from operator
      .sort({ createdAt: -1 });

    res.json({ success: true, data: orders });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});


// =====================================================
//  GET USER ORDERS   /api/orders/my
// =====================================================
router.get("/my", authMiddleware, roleMiddleware("user"), async (req, res) => {
  try {
    const orders = await Order.find({ userId: req.user.id }).sort({ createdAt: -1 });
    res.json({ success: true, data: orders });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});


// =====================================================
//  CREATE ORDER   POST /api/orders
// =====================================================
router.post("/", authMiddleware, roleMiddleware("user"), async (req, res) => {
  try {
    const {
      operatorId,
      restaurantName,
      items,
      paymentMethod,
      applyStudentDiscount,
      phone,
      address,
      instructions
    } = req.body;

    // Validate contact info
    if (!phone || !address) {
      return res.status(400).json({ success: false, message: "Phone number and delivery address are required." });
    }

    // Update user profile with latest contact info (Store Permanently)
    const User = require("../models/User");
    await User.findByIdAndUpdate(req.user.id, { phone, address });

    // Validate paymentMethod
    if (!["cod", "upi"].includes(paymentMethod)) {
      return res.status(400).json({ success: false, message: "paymentMethod must be 'cod' or 'upi'." });
    }

    // ... items validation and calculation ...
    // Validate items array
    if (!items || items.length === 0) {
      return res.status(400).json({ success: false, message: "No items provided." });
    }

    const operator = await Operator.findById(operatorId);
    if (!operator) {
      return res.status(400).json({ success: false, message: "Invalid operator." });
    }

    let total = 0;
    const formattedItems = [];

    for (const item of items) {
      if (!item.menuItemId || !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 50) {
        return res.status(400).json({ success: false, message: "Invalid item quantity." });
      }

      const menuItem = await MenuItem.findById(item.menuItemId);
      if (!menuItem) continue;

      total += menuItem.price * item.quantity;

      await MenuItem.findByIdAndUpdate(menuItem._id, { $inc: { orderCount: item.quantity } });

      formattedItems.push({
        menuItemId: menuItem._id,
        name: menuItem.name,
        price: menuItem.price,
        quantity: item.quantity,
        image: menuItem.image,
      });
    }

    if (formattedItems.length === 0) {
      return res.status(400).json({ success: false, message: "No valid menu items found." });
    }

    // ── Student Discount (20%) ────────────────────────────────────
    let studentDiscountApplied = false;
    let discountAmount = 0;

    if (applyStudentDiscount) {
      const userRecord = await User.findById(req.user.id);
      const isVerified = userRecord?.studentStatus === "verified";
      const notExpired = userRecord?.idExpiryDate && userRecord.idExpiryDate > new Date();

      if (isVerified && notExpired) {
        discountAmount = Math.round(total * 0.20);
        total = total - discountAmount;
        studentDiscountApplied = true;
      } else {
        return res.status(403).json({
          success: false,
          message: "Student discount could not be applied. Please verify your student ID first."
        });
      }
    }

    const order = await Order.create({
      userId: req.user.id,
      userName: req.user.fullName,
      userEmail: req.user.email,
      customerPhone: phone,
      customerAddress: address,
      instructions: instructions || "",
      operatorId: operator._id,
      restaurantName: operator.restaurantName,
      items: formattedItems,
      totalAmount: total,
      status: "pending",
      paymentMethod,
      paymentStatus: "pending",
      studentDiscountApplied,
      discountAmount,
    });

    res.json({ success: true, data: order });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});


// =====================================================
//  SIMULATE UPI PAYMENT   PUT /api/orders/:id/pay
//  Only user who owns the order can call this.
//  Backend is the source of truth — frontend cannot
//  fake this call for another user's order.
// =====================================================
router.put("/:id/pay", authMiddleware, roleMiddleware("user"), async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ success: false, message: "Order not found." });

    // Ownership check
    if (order.userId.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: "Unauthorized." });
    }

    if (order.paymentMethod !== "upi") {
      return res.status(400).json({ success: false, message: "This order is not a UPI order." });
    }

    if (order.paymentStatus === "paid") {
      return res.status(400).json({ success: false, message: "Order is already paid." });
    }

    order.paymentStatus = "paid";
    await order.save();

    res.json({ success: true, message: "Payment confirmed!", data: order });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});


// =====================================================
//  UPDATE ORDER STATUS   PUT /api/orders/:id/status
//  Operator only. "delivered" is BLOCKED here —
//  delivery must happen via OTP verification.
// =====================================================
router.put("/:id/status", authMiddleware, roleMiddleware("operator"), async (req, res) => {
  try {
    const { status, rejectionReason } = req.body;

    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ success: false, message: "Order not found." });
    if (order.operatorId.toString() !== req.user.id) return res.status(403).json({ success: false, message: "Unauthorized." });

    // ─── Block direct "delivered" — must use /verify-otp ───
    if (status === "delivered") {
      return res.status(400).json({
        success: false,
        message: "Delivery can only be confirmed via OTP. Use POST /api/orders/:id/verify-otp.",
      });
    }

    const validTransitions = {
      pending: ["confirmed", "rejected", "cancel_requested"],
      confirmed: ["preparing", "cancel_requested"],
      preparing: ["out_for_delivery"],
      out_for_delivery: [],   // delivery only via OTP route
      cancel_requested: ["cancelled", "confirmed", "preparing"],
    };

    if (order.status !== status && !validTransitions[order.status]?.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid transition: ${order.status} → ${status}`,
      });
    }

    // ─── Generate OTP when moving to out_for_delivery ───
    if (status === "out_for_delivery") {
      order.deliveryOTP = generateOTP();
    }

    order.status = status;

    // Refund logic: if paid and rejected/cancelled, mark as refunded
    if (["rejected", "cancelled"].includes(status) && order.paymentStatus === "paid") {
      order.paymentStatus = "refunded";
    }

    if (status === "rejected") {
      order.rejectionReason = rejectionReason || "";
    }
    if (status === "cancelled") {
      order.cancellationReason = rejectionReason || order.cancellationReason || "Cancelled by operator";
    }

    await order.save();

    // Return order but strip OTP from response (don't send OTP to operator via this route — they enter it from the user)
    const safeOrder = order.toObject();
    delete safeOrder.deliveryOTP;

    res.json({ success: true, data: safeOrder });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});


// =====================================================
//  VERIFY DELIVERY OTP   POST /api/orders/:id/verify-otp
//  Called by the OPERATOR. If OTP matches:
//    - Sets status = "delivered"
//    - Sets paymentStatus = "paid" (covers COD)
//    - Clears deliveryOTP
// =====================================================
router.post("/:id/verify-otp", authMiddleware, roleMiddleware("operator"), async (req, res) => {
  try {
    const { otp } = req.body;

    if (!otp) return res.status(400).json({ success: false, message: "OTP is required." });

    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ success: false, message: "Order not found." });
    if (order.operatorId.toString() !== req.user.id) return res.status(403).json({ success: false, message: "Unauthorized." });

    if (order.status !== "out_for_delivery") {
      return res.status(400).json({ success: false, message: "Order is not out for delivery." });
    }

    if (!order.deliveryOTP) {
      return res.status(400).json({ success: false, message: "No OTP generated for this order." });
    }

    if (order.deliveryOTP !== String(otp).trim()) {
      return res.status(400).json({ success: false, message: "❌ Invalid OTP. Please try again." });
    }

    // OTP verified — complete the delivery
    order.status = "delivered";
    order.paymentStatus = "paid";  // covers both COD and UPI final confirmation
    order.deliveryOTP = null;
    await order.save();

    res.json({ success: true, message: "✅ Delivery confirmed! Order marked as delivered.", data: order });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});


// =====================================================
//  CANCEL ORDER (User)   PATCH /api/orders/:id/cancel
// =====================================================
router.patch("/:id/cancel", authMiddleware, roleMiddleware("user"), async (req, res) => {
  try {
    const { reason } = req.body;
    const order = await Order.findById(req.params.id);

    if (!order) return res.status(404).json({ success: false, message: "Order not found." });
    if (order.userId.toString() !== req.user.id) return res.status(403).json({ success: false, message: "Unauthorized." });

    if (!["pending", "confirmed"].includes(order.status)) {
      return res.status(400).json({ success: false, message: `Cannot cancel order in '${order.status}' state.` });
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
