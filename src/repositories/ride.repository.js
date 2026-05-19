/**
 * Ride Repository
 * All ride-related database operations via Prisma (PostgreSQL)
 */
const prisma = require("../config/prisma");

/**
 * Create a new ride
 */
const createRide = async (data) => {
  const {
    riderId, pickupAddress, pickupLat, pickupLng,
    destinationAddress, destinationLat, destinationLng,
    distanceKm, estimatedFare, offeredFare, rideOTP,
  } = data;

  return prisma.ride.create({
    data: {
      riderId, pickupAddress, pickupLat, pickupLng,
      destinationAddress, destinationLat, destinationLng,
      distanceKm, estimatedFare, offeredFare, rideOTP,
    },
    include: {
      rider: { include: { user: { select: { name: true, phone: true } } } },
    },
  });
};

/**
 * Find ride by ID with full relations
 */
const findRideById = async (id) =>
  prisma.ride.findUnique({
    where:   { id },
    include: {
      rider:  { include: { user: { select: { id: true, name: true, phone: true } } } },
      driver: { include: { user: { select: { id: true, name: true, phone: true } } } },
      vehicle: true,
      payment: true,
    },
  });

/**
 * Get pending rides (for driver dashboard)
 */
const findPendingRides = async () =>
  prisma.ride.findMany({
    where:   { status: "PENDING" },
    include: { rider: { include: { user: { select: { name: true, phone: true } } } } },
    orderBy: { createdAt: "desc" },
  });

/**
 * Get rider's ride history with pagination
 */
const findRidesByRider = async (riderId, { page = 1, limit = 10, status } = {}) => {
  const where = { riderId, ...(status && { status }) };
  const skip  = (page - 1) * limit;

  const [rides, total] = await prisma.$transaction([
    prisma.ride.findMany({
      where,
      include: { driver: { include: { user: { select: { name: true, phone: true } } } }, payment: true },
      orderBy: { createdAt: "desc" },
      skip,
      take:  limit,
    }),
    prisma.ride.count({ where }),
  ]);

  return { rides, total };
};

/**
 * Get driver's active ride (accepted or started)
 */
const findActiveRideByDriver = async (driverId) =>
  prisma.ride.findFirst({
    where:   { driverId, status: { in: ["ACCEPTED", "STARTED"] } },
    include: {
      rider:   { include: { user: { select: { id: true, name: true, phone: true } } } },
      payment: true,
    },
  });

/**
 * Get driver's ride history with earnings
 */
const findRidesByDriver = async (driverId, { page = 1, limit = 10 } = {}) => {
  const where = { driverId };
  const skip  = (page - 1) * limit;

  const [rides, total] = await prisma.$transaction([
    prisma.ride.findMany({
      where,
      include: { rider: { include: { user: { select: { name: true } } } }, payment: true },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.ride.count({ where }),
  ]);

  return { rides, total };
};

/**
 * Update ride status with conditional field updates
 */
const updateRideStatus = async (rideId, status, additionalData = {}) => {
  const statusTimestamps = {
    ACCEPTED:  { acceptedAt:  new Date() },
    STARTED:   { startedAt:   new Date() },
    COMPLETED: { completedAt: new Date() },
    CANCELLED: { cancelledAt: new Date() },
    REJECTED:  {},
  };

  return prisma.ride.update({
    where: { id: rideId },
    data:  { status, ...statusTimestamps[status], ...additionalData },
    include: {
      rider:  { include: { user: { select: { id: true, name: true } } } },
      driver: { include: { user: { select: { id: true, name: true } } } },
    },
  });
};

/**
 * Assign driver to ride (on accept)
 */
const assignDriver = async (rideId, driverId, vehicleId) =>
  updateRideStatus(rideId, "ACCEPTED", { driverId, vehicleId });

/**
 * Verify ride OTP and mark as started
 */
const verifyOTPAndStartRide = async (rideId) =>
  prisma.ride.update({
    where: { id: rideId },
    data:  { otpVerified: true, status: "STARTED", startedAt: new Date() },
  });

/**
 * Get driver's total earnings
 */
const getDriverEarnings = async (driverId) => {
  const result = await prisma.ride.aggregate({
    where:   { driverId, status: "COMPLETED" },
    _sum:    { finalFare: true },
    _count:  { id: true },
  });

  return {
    totalEarnings: result._sum.finalFare || 0,
    totalRides:    result._count.id,
  };
};

/**
 * Update razorpay order ID on ride
 */
const updateRazorpayOrderId = async (rideId, orderId) =>
  prisma.ride.update({
    where: { id: rideId },
    data:  { payment: { upsert: { create: { amount: 0, razorpayOrderId: orderId }, update: { razorpayOrderId: orderId } } } },
  });

module.exports = {
  createRide,
  findRideById,
  findPendingRides,
  findRidesByRider,
  findActiveRideByDriver,
  findRidesByDriver,
  updateRideStatus,
  assignDriver,
  verifyOTPAndStartRide,
  getDriverEarnings,
  updateRazorpayOrderId,
};
