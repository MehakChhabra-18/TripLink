/**
 * Payment Routes
 */
const express = require("express");
const router  = express.Router();
const paymentController = require("../controllers/payment.controller");
const { authenticate } = require("../middleware/auth.middleware");
const { validate } = require("../middleware/validate.middleware");
const { createOrderSchema, verifyPaymentSchema } = require("../validations/payment.validation");

// ─── Razorpay Webhook (raw body — no JSON parser) ─────────────────────────────
router.post(
  "/webhook",
  express.raw({ type: "application/json" }),
  (req, res, next) => {
    // Expose raw body for signature verification
    req.rawBody = req.body.toString("utf-8");
    next();
  },
  paymentController.handleWebhook
);

// ─── Protected Payment Routes ─────────────────────────────────────────────────
router.post("/create-order",
  authenticate,
  validate(createOrderSchema),
  paymentController.createOrder
);

router.post("/verify",
  authenticate,
  validate(verifyPaymentSchema),
  paymentController.verifyPayment
);

router.get("/:rideId/status",
  authenticate,
  paymentController.getPaymentStatus
);

module.exports = router;
