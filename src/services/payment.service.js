/**
 * Payment Service
 * Razorpay integration with full transaction lifecycle
 */
const crypto = require("crypto");
const razorpay = require("../config/razorpay");
const paymentRepo = require("../repositories/payment.repository");
const rideRepo    = require("../repositories/ride.repository");
const AppError    = require("../utils/AppError");
const { RIDE_STATUS } = require("../constants");

/**
 * Create Razorpay order for a ride
 * @param {string} rideId
 * @param {number} amount   - amount in INR (will be converted to paise)
 * @param {string} userId   - requesting user ID (for validation)
 */
const createOrder = async (rideId, amount, userId) => {
  const ride = await rideRepo.findRideById(rideId);
  if (!ride) throw AppError.notFound("Ride not found");

  if (ride.status !== RIDE_STATUS.COMPLETED) {
    throw AppError.badRequest("Payment can only be initiated for completed rides", "RIDE_NOT_COMPLETED");
  }

  const existingPayment = await paymentRepo.findPaymentByRideId(rideId);
  if (existingPayment?.status === "PAID") {
    throw AppError.conflict("Ride has already been paid", "ALREADY_PAID");
  }

  // Razorpay expects amount in paise (1 INR = 100 paise)
  const amountPaise = Math.round(amount * 100);

  const order = await razorpay.orders.create({
    amount:   amountPaise,
    currency: "INR",
    receipt:  `triplink_${rideId.slice(0, 8)}`,
    notes: {
      rideId,
      riderId: ride.rider.user.id,
    },
  });

  // Store payment record
  await paymentRepo.upsertPayment(rideId, {
    amount,
    currency:        "INR",
    status:          "PENDING",
    razorpayOrderId: order.id,
  });

  return {
    orderId:  order.id,
    amount:   order.amount,
    currency: order.currency,
    key:      process.env.RAZORPAY_KEY_ID,
  };
};

/**
 * Verify Razorpay payment signature and mark ride as paid
 */
const verifyPayment = async ({ rideId, razorpay_order_id, razorpay_payment_id, razorpay_signature }) => {
  // Verify HMAC-SHA256 signature
  const expectedSignature = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
    .update(`${razorpay_order_id}|${razorpay_payment_id}`)
    .digest("hex");

  if (expectedSignature !== razorpay_signature) {
    await paymentRepo.markPaymentFailed(rideId, "Signature mismatch");
    throw AppError.badRequest("Payment verification failed — invalid signature", "PAYMENT_INVALID_SIGNATURE");
  }

  const payment = await paymentRepo.markPaymentPaid(rideId, {
    razorpayPaymentId: razorpay_payment_id,
    razorpaySignature: razorpay_signature,
  });

  return payment;
};

/**
 * Handle Razorpay webhook
 * Validates webhook signature and processes events
 */
const handleWebhook = async (rawBody, signature) => {
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;

  if (webhookSecret) {
    const expectedSig = crypto
      .createHmac("sha256", webhookSecret)
      .update(rawBody)
      .digest("hex");

    if (expectedSig !== signature) {
      throw AppError.unauthorized("Invalid webhook signature");
    }
  }

  const event = JSON.parse(rawBody);

  switch (event.event) {
    case "payment.captured": {
      const payment = event.payload.payment.entity;
      const rideId  = payment.notes?.rideId;
      if (rideId) {
        await paymentRepo.markPaymentPaid(rideId, {
          razorpayPaymentId: payment.id,
          razorpaySignature: "",
        });
      }
      break;
    }

    case "payment.failed": {
      const payment = event.payload.payment.entity;
      const rideId  = payment.notes?.rideId;
      if (rideId) {
        await paymentRepo.markPaymentFailed(rideId, payment.error_description || "Payment failed");
      }
      break;
    }

    case "refund.created": {
      const refund  = event.payload.refund.entity;
      const payment = await paymentRepo.findPaymentByOrderId(refund.payment_id);
      if (payment) {
        await paymentRepo.recordRefund(payment.rideId, {
          refundId:     refund.id,
          refundAmount: refund.amount / 100,
        });
      }
      break;
    }
  }

  return { received: true };
};

/**
 * Get payment status for a ride
 */
const getPaymentStatus = async (rideId) => {
  const payment = await paymentRepo.findPaymentByRideId(rideId);
  if (!payment) throw AppError.notFound("Payment not found for this ride");
  return payment;
};

module.exports = { createOrder, verifyPayment, handleWebhook, getPaymentStatus };
