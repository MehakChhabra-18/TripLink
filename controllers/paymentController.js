const prisma = require("../src/config/prisma");
const { createOrder, verifySignature } = require("../services/razorpayService");

// ─── CREATE RAZORPAY ORDER ────────────────────────────────────────────────────
exports.createOrder = async (req, res) => {
  try {
    const { amount, rideId } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ error: "Valid amount is required" });
    }

    const order = await createOrder(amount);

    if (rideId) {
      // Upsert payment entry for the ride
      await prisma.payment.upsert({
        where: { rideId },
        update: { razorpayOrderId: order.id, amount: parseFloat(amount) },
        create: { rideId, amount: parseFloat(amount), razorpayOrderId: order.id }
      });
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

    if (rideId) {
      await prisma.payment.update({
        where: { rideId },
        data: {
          status: "PAID",
          razorpayPaymentId: razorpay_payment_id,
          razorpaySignature: razorpay_signature
        }
      });

      await prisma.ride.update({
        where: { id: rideId },
        data: { paymentStatus: "PAID" }
      });

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
exports.confirmCash = async (req, res) => {
  try {
    const { rideId } = req.body;

    if (!rideId) {
      return res.status(400).json({ success: false, error: "Ride ID is required" });
    }

    await prisma.ride.update({
      where: { id: rideId },
      data: { paymentStatus: "PAID" }
    });

    if (global.io) {
      global.io.emit("rideStatusUpdate", { status: "PAID", rideId });
    }

    res.json({ success: true, message: "Cash payment confirmed" });
  } catch (err) {
    console.error("confirmCash error:", err);
    res.status(500).json({ error: err.message });
  }
};
