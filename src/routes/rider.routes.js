/**
 * Rider Routes
 * Profile, preferences
 */
const router = require("express").Router();
const prisma  = require("../config/prisma");
const asyncHandler = require("../utils/asyncHandler");
const { sendSuccess, sendError } = require("../utils/response");
const { authenticate, authorize } = require("../middleware/auth.middleware");
const { ROLES } = require("../constants");

// All rider routes require authentication + RIDER role
router.use(authenticate, authorize(ROLES.RIDER));

// ─── GET /api/v1/rider/profile ────────────────────────────────────────────────
router.get("/profile", asyncHandler(async (req, res) => {
  const rider = await prisma.rider.findUnique({
    where:   { userId: req.user.id },
    include: {
      user: {
        select: { id: true, name: true, email: true, phone: true, profileImage: true, isVerified: true },
      },
    },
  });

  if (!rider) return sendError(res, 404, "Rider profile not found");
  sendSuccess(res, 200, "Rider profile", { rider });
}));

// ─── GET /api/v1/rider/active-ride ────────────────────────────────────────────
// Get rider's current active ride (pending/accepted/started)
router.get("/active-ride", asyncHandler(async (req, res) => {
  const rider = await prisma.rider.findUnique({ where: { userId: req.user.id } });
  if (!rider) return sendError(res, 404, "Rider profile not found");

  const ride = await prisma.ride.findFirst({
    where:   { riderId: rider.id, status: { in: ["PENDING", "ACCEPTED", "STARTED"] } },
    include: {
      driver: {
        include: { user: { select: { name: true, phone: true } }, vehicles: { where: { isActive: true }, take: 1 } },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  sendSuccess(res, 200, "Active ride", { ride: ride || null });
}));

module.exports = router;
