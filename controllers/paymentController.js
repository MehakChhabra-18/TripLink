const Ride = require("../models/Ride");
const { createOrder, verifySignature } = require("../services/razorpayService");

// ─── CREATE RAZORPAY ORDER ────────────────────────────────────────────────────
// POST /api/v1/payment/create-order
exports.createOrder = async (req, res) => {
  try {
    const { amount, rideId } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ error: "Valid amount is required" });
    }

    const order = await createOrder(amount);

    // Save orderId on the ride document
    if (rideId) {
      await Ride.findByIdAndUpdate(rideId, { razorpayOrderId: order.id });
    }

    res.json({
      orderId:  order.id,
      amount:   order.amount,
      currency: order.currency,
      key:      process.env.RAZORPAY_KEY_ID || "rzp_test_REPLACE_WITH_YOUR_KEY_ID",
    });
  } catch (err) {
    console.error("createOrder error:", err);
    res.status(500).json({ error: err.message });
  }
};

// ─── VERIFY PAYMENT SIGNATURE ─────────────────────────────────────────────────
// POST /api/v1/payment/verify
exports.verifyPayment = async (req, res) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      rideId,
    } = req.body;

    const isValid = verifySignature(
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature
    );

    if (!isValid) {
      return res.status(400).json({ success: false, error: "Payment verification failed" });
    }

    // Mark ride as paid in DB
    if (rideId) {
      await Ride.findByIdAndUpdate(rideId, {
        paymentStatus:     "paid",
        razorpayPaymentId: razorpay_payment_id,
      });

      // Notify rider via socket
      if (global.io) {
        global.io.emit("rideStatusUpdate", { status: "PAID", rideId });
      }
    }

    res.json({ success: true, message: "Payment verified successfully" });
  } catch (err) {
    console.error("verifyPayment error:", err);
    res.status(500).json({ error: err.message });
  }
};

// ─── CONFIRM CASH PAYMENT (Driver Side) ──────────────────────────────────────
// POST /api/v1/payment/confirm-cash
exports.confirmCash = async (req, res) => {
  try {
    const { rideId } = req.body;

    if (!rideId) {
      return res.status(400).json({ success: false, error: "Ride ID is required" });
    }

    // Mark ride as paid in DB
    await Ride.findByIdAndUpdate(rideId, { paymentStatus: "paid" });

    // Notify rider via socket
    if (global.io) {
      global.io.emit("rideStatusUpdate", { status: "PAID", rideId });
    }

    res.json({ success: true, message: "Cash payment confirmed" });
  } catch (err) {
    console.error("confirmCash error:", err);
    res.status(500).json({ error: err.message });
  }
};
