/**
 * Payment Repository
 * All payment-related database operations via Prisma
 */
const prisma = require("../config/prisma");

/**
 * Create or update payment record for a ride
 */
const upsertPayment = async (rideId, data) =>
  prisma.payment.upsert({
    where:  { rideId },
    create: { rideId, ...data },
    update: data,
  });

/**
 * Find payment by ride ID
 */
const findPaymentByRideId = async (rideId) =>
  prisma.payment.findUnique({ where: { rideId } });

/**
 * Find payment by Razorpay order ID
 */
const findPaymentByOrderId = async (orderId) =>
  prisma.payment.findFirst({ where: { razorpayOrderId: orderId } });

/**
 * Mark payment as paid
 */
const markPaymentPaid = async (rideId, { razorpayPaymentId, razorpaySignature }) =>
  prisma.payment.update({
    where: { rideId },
    data:  {
      status:              "PAID",
      razorpayPaymentId,
      razorpaySignature,
    },
  });

/**
 * Mark payment as failed
 */
const markPaymentFailed = async (rideId, reason) =>
  prisma.payment.update({
    where: { rideId },
    data:  { status: "FAILED", failureReason: reason },
  });

/**
 * Record refund details
 */
const recordRefund = async (rideId, { refundId, refundAmount }) =>
  prisma.payment.update({
    where: { rideId },
    data:  { status: "REFUNDED", refundId, refundAmount, refundedAt: new Date() },
  });

/**
 * Get all payments with pagination (admin)
 */
const findAllPayments = async ({ page = 1, limit = 10 } = {}) => {
  const skip = (page - 1) * limit;
  const [payments, total] = await prisma.$transaction([
    prisma.payment.findMany({
      skip,
      take:    limit,
      include: { ride: { include: { rider: { include: { user: { select: { name: true, email: true } } } } } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.payment.count(),
  ]);
  return { payments, total };
};

/**
 * Get payment analytics (total revenue, paid, failed, refunded counts)
 */
const getPaymentAnalytics = async () =>
  prisma.payment.groupBy({
    by:    ["status"],
    _sum:  { amount: true },
    _count: { id: true },
  });

module.exports = {
  upsertPayment,
  findPaymentByRideId,
  findPaymentByOrderId,
  markPaymentPaid,
  markPaymentFailed,
  recordRefund,
  findAllPayments,
  getPaymentAnalytics,
};
