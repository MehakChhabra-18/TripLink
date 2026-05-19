/**
 * Admin Routes
 * User management, rides overview, payment analytics
 * Protected: ADMIN role only
 */
const router = require("express").Router();
const prisma  = require("../config/prisma");
const asyncHandler = require("../utils/asyncHandler");
const { sendSuccess, buildMeta } = require("../utils/response");
const { authenticate, authorize } = require("../middleware/auth.middleware");
const { ROLES } = require("../constants");

// All admin routes require ADMIN role
router.use(authenticate, authorize(ROLES.ADMIN));

// ─── GET /api/v1/admin/users ──────────────────────────────────────────────────
// List all users with pagination
router.get("/users", asyncHandler(async (req, res) => {
  const page  = parseInt(req.query.page)  || 1;
  const limit = parseInt(req.query.limit) || 10;
  const role  = req.query.role; // optional filter: RIDER | DRIVER
  const skip  = (page - 1) * limit;

  const where = role ? { role } : {};

  const [users, total] = await prisma.$transaction([
    prisma.user.findMany({
      where,
      select: {
        id: true, name: true, email: true, phone: true,
        role: true, isVerified: true, isActive: true, createdAt: true,
      },
      skip,
      take:    limit,
      orderBy: { createdAt: "desc" },
    }),
    prisma.user.count({ where }),
  ]);

  sendSuccess(res, 200, "Users list", { users }, buildMeta(total, page, limit));
}));

// ─── PATCH /api/v1/admin/users/:id/toggle ────────────────────────────────────
// Activate / deactivate a user account
router.patch("/users/:id/toggle", asyncHandler(async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.params.id } });
  if (!user) return res.status(404).json({ success: false, message: "User not found" });

  const updated = await prisma.user.update({
    where: { id: req.params.id },
    data:  { isActive: !user.isActive },
    select: { id: true, name: true, isActive: true },
  });

  sendSuccess(res, 200, `User ${updated.isActive ? "activated" : "deactivated"}`, { user: updated });
}));

// ─── GET /api/v1/admin/rides ──────────────────────────────────────────────────
// All rides with filters
router.get("/rides", asyncHandler(async (req, res) => {
  const page   = parseInt(req.query.page)  || 1;
  const limit  = parseInt(req.query.limit) || 10;
  const status = req.query.status;
  const skip   = (page - 1) * limit;

  const where = status ? { status } : {};

  const [rides, total] = await prisma.$transaction([
    prisma.ride.findMany({
      where,
      include: {
        rider:  { include: { user: { select: { name: true, phone: true } } } },
        driver: { include: { user: { select: { name: true, phone: true } } } },
        payment: true,
      },
      skip,
      take:    limit,
      orderBy: { createdAt: "desc" },
    }),
    prisma.ride.count({ where }),
  ]);

  sendSuccess(res, 200, "Rides list", { rides }, buildMeta(total, page, limit));
}));

// ─── GET /api/v1/admin/analytics ─────────────────────────────────────────────
// Dashboard summary stats
router.get("/analytics", asyncHandler(async (req, res) => {
  const [
    totalUsers,
    totalRiders,
    totalDrivers,
    totalRides,
    completedRides,
    pendingRides,
    paymentStats,
  ] = await prisma.$transaction([
    prisma.user.count(),
    prisma.user.count({ where: { role: "RIDER" } }),
    prisma.user.count({ where: { role: "DRIVER" } }),
    prisma.ride.count(),
    prisma.ride.count({ where: { status: "COMPLETED" } }),
    prisma.ride.count({ where: { status: "PENDING" } }),
    prisma.payment.aggregate({
      where:  { status: "PAID" },
      _sum:   { amount: true },
      _count: { id: true },
    }),
  ]);

  sendSuccess(res, 200, "Analytics", {
    users:    { total: totalUsers, riders: totalRiders, drivers: totalDrivers },
    rides:    { total: totalRides, completed: completedRides, pending: pendingRides },
    revenue:  {
      total:       paymentStats._sum.amount || 0,
      paidOrders:  paymentStats._count.id,
    },
  });
}));

// ─── GET /api/v1/admin/payments ───────────────────────────────────────────────
// All payments overview
router.get("/payments", asyncHandler(async (req, res) => {
  const page  = parseInt(req.query.page)  || 1;
  const limit = parseInt(req.query.limit) || 10;
  const skip  = (page - 1) * limit;

  const [payments, total] = await prisma.$transaction([
    prisma.payment.findMany({
      include: {
        ride: {
          select: {
            id: true, pickupAddress: true, destinationAddress: true,
            rider: { include: { user: { select: { name: true } } } },
          },
        },
      },
      skip,
      take:    limit,
      orderBy: { createdAt: "desc" },
    }),
    prisma.payment.count(),
  ]);

  sendSuccess(res, 200, "Payments overview", { payments }, buildMeta(total, page, limit));
}));

module.exports = router;
