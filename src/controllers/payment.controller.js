/**
 * Payment Controller
 * Handles req/res for payment endpoints
 */
const paymentService = require("../services/payment.service");
const asyncHandler   = require("../utils/asyncHandler");
const { sendSuccess } = require("../utils/response");

// ─── POST /api/v1/payments/create-order ──────────────────────────────────────
const createOrder = asyncHandler(async (req, res) => {
  const { rideId, amount } = req.body;
  const order = await paymentService.createOrder(rideId, amount, req.user.id);
  sendSuccess(res, 201, "Payment order created", order);
});

// ─── POST /api/v1/payments/verify ─────────────────────────────────────────────
const verifyPayment = asyncHandler(async (req, res) => {
  const payment = await paymentService.verifyPayment(req.body);
  sendSuccess(res, 200, "Payment verified successfully", { payment });
});

// ─── POST /api/v1/payments/webhook ────────────────────────────────────────────
// Note: webhook endpoint must NOT use JSON body parser — needs raw body
const handleWebhook = asyncHandler(async (req, res) => {
  const signature = req.headers["x-razorpay-signature"];
  await paymentService.handleWebhook(req.rawBody, signature);
  res.status(200).json({ received: true });
});

// ─── GET /api/v1/payments/:rideId/status ─────────────────────────────────────
const getPaymentStatus = asyncHandler(async (req, res) => {
  const payment = await paymentService.getPaymentStatus(req.params.rideId);
  sendSuccess(res, 200, "Payment status", { payment });
});

module.exports = { createOrder, verifyPayment, handleWebhook, getPaymentStatus };
