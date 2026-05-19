const express            = require("express");
const router             = express.Router();
const paymentController  = require("../controllers/paymentController");
const { dualAuth }       = require("../middleware/auth");

// ─── CREATE RAZORPAY ORDER ────────────────────────────────────────────────────
// POST /api/v1/payment/create-order
// Body: { amount: <number in ₹>, rideId: <string> }
router.post("/create-order", dualAuth, paymentController.createOrder);

// ─── VERIFY PAYMENT SIGNATURE ─────────────────────────────────────────────────
// POST /api/v1/payment/verify
// Body: { razorpay_order_id, razorpay_payment_id, razorpay_signature, rideId }
router.post("/verify", dualAuth, paymentController.verifyPayment);

// ─── CONFIRM CASH PAYMENT (Driver Side) ──────────────────────────────────────
// POST /api/v1/payment/confirm-cash
// Body: { rideId }
router.post("/confirm-cash", dualAuth, paymentController.confirmCash);

module.exports = router;
