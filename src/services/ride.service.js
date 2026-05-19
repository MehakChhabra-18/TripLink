/**
 * Ride Service
 * Business logic for all ride lifecycle operations
 */
const rideRepo = require("../repositories/ride.repository");
const authRepo = require("../repositories/auth.repository");
const prisma   = require("../config/prisma");
const AppError = require("../utils/AppError");
const { estimateRideFare } = require("../utils/fare");
const { generateOTP } = require("../utils/otp");
const { RIDE_STATUS } = require("../constants");

/**
 * Book a ride (rider)
 * - Estimate distance & fare
 * - Generate ride-start OTP
 * - Emit socket event to all online drivers
 */
const bookRide = async (riderId, rideData, io) => {
  const {
    pickupAddress, pickupLat, pickupLng,
    destinationAddress, destinationLat, destinationLng,
    offeredFare,
  } = rideData;

  // Resolve rider profile ID from user ID
  const rider = await prisma.rider.findUnique({ where: { userId: riderId } });
  if (!rider) throw AppError.notFound("Rider profile not found");

  const { distanceKm, estimatedFare } = estimateRideFare(pickupAddress, destinationAddress);
  const rideOTP = generateOTP(4); // 4-digit ride-start OTP

  const ride = await rideRepo.createRide({
    riderId:  rider.id,
    pickupAddress, pickupLat, pickupLng,
    destinationAddress, destinationLat, destinationLng,
    distanceKm,
    estimatedFare,
    offeredFare,
    rideOTP,
  });

  // Get rider user data for socket payload
  const riderUser = await authRepo.findUserById(riderId);

  // Emit to all connected drivers
  if (io) {
    io.emit("newRide", {
      id:                 ride.id,
      pickupAddress:      ride.pickupAddress,
      destinationAddress: ride.destinationAddress,
      distanceKm:         ride.distanceKm,
      estimatedFare:      ride.estimatedFare,
      offeredFare:        ride.offeredFare,
      riderName:          riderUser?.name,
    });
  }

  return ride;
};

/**
 * Get fare estimate without booking
 */
const getFareEstimate = (pickup, destination) =>
  estimateRideFare(pickup, destination);

/**
 * Driver accepts a ride
 */
const acceptRide = async (driverId, rideId, io) => {
  const ride = await rideRepo.findRideById(rideId);
  if (!ride) throw AppError.notFound("Ride not found");
  if (ride.status !== RIDE_STATUS.PENDING) {
    throw AppError.badRequest("Ride is no longer available", "RIDE_NOT_AVAILABLE");
  }

  // Resolve driver profile
  const driver = await prisma.driver.findUnique({
    where:   { userId: driverId },
    include: { vehicles: { where: { isActive: true }, take: 1 } },
  });
  if (!driver) throw AppError.notFound("Driver profile not found");

  const vehicleId = driver.vehicles[0]?.id || null;

  const updatedRide = await rideRepo.assignDriver(rideId, driver.id, vehicleId);

  // Notify the rider
  if (io) {
    const riderId = updatedRide.rider.user.id;
    io.to(riderId).emit("rideAccepted", {
      rideId:     updatedRide.id,
      driverId,
      driverName: (await authRepo.findUserById(driverId))?.name,
    });
    // Notify all drivers ride is gone
    io.emit("rideGone", { rideId: updatedRide.id });
  }

  return updatedRide;
};

/**
 * Driver rejects a ride
 */
const rejectRide = async (driverId, rideId, io) => {
  const ride = await rideRepo.findRideById(rideId);
  if (!ride) throw AppError.notFound("Ride not found");

  const updatedRide = await rideRepo.updateRideStatus(rideId, RIDE_STATUS.REJECTED);

  if (io) {
    const riderId = updatedRide.rider.user.id;
    io.to(riderId).emit("rideRejected", { rideId });
    io.emit("rideGone", { rideId });
  }

  return updatedRide;
};

/**
 * Verify ride-start OTP and mark as started
 */
const verifyRideOTP = async (driverId, rideId, inputOTP, io) => {
  const ride = await rideRepo.findRideById(rideId);
  if (!ride) throw AppError.notFound("Ride not found");
  if (ride.status !== RIDE_STATUS.ACCEPTED) {
    throw AppError.badRequest("Ride is not in accepted status");
  }

  if (ride.rideOTP !== String(inputOTP)) {
    throw AppError.badRequest("Invalid OTP", "OTP_INVALID");
  }

  const updatedRide = await rideRepo.verifyOTPAndStartRide(rideId);

  if (io) {
    const riderId = ride.rider.user.id;
    io.to(riderId).emit("rideStatusUpdate", { status: "STARTED", rideId });
  }

  return updatedRide;
};

/**
 * Complete a ride
 */
const completeRide = async (driverId, rideId, io) => {
  const ride = await rideRepo.findRideById(rideId);
  if (!ride) throw AppError.notFound("Ride not found");
  if (ride.status !== RIDE_STATUS.STARTED) {
    throw AppError.badRequest("Ride must be started before completing");
  }

  const finalFare   = ride.offeredFare || ride.estimatedFare;
  const updatedRide = await rideRepo.updateRideStatus(rideId, RIDE_STATUS.COMPLETED, { finalFare });

  // Update driver stats
  await prisma.driver.update({
    where: { id: ride.driverId },
    data:  {
      totalRides:    { increment: 1 },
      totalEarnings: { increment: finalFare },
    },
  });

  if (io) {
    const riderId = updatedRide.rider.user.id;
    io.to(riderId).emit("rideStatusUpdate", { status: "COMPLETED", rideId });
  }

  return updatedRide;
};

/**
 * Cancel a ride (rider or driver)
 */
const cancelRide = async (userId, rideId, io) => {
  const ride = await rideRepo.findRideById(rideId);
  if (!ride) throw AppError.notFound("Ride not found");

  const cancellableStatuses = [RIDE_STATUS.PENDING, RIDE_STATUS.ACCEPTED];
  if (!cancellableStatuses.includes(ride.status)) {
    throw AppError.badRequest("Ride cannot be cancelled at this stage", "CANNOT_CANCEL");
  }

  const updatedRide = await rideRepo.updateRideStatus(rideId, RIDE_STATUS.CANCELLED);

  if (io) {
    io.to(ride.rider.user.id).emit("rideStatusUpdate", { status: "CANCELLED", rideId });
    if (ride.driverId) {
      io.to(ride.driver.user.id).emit("rideStatusUpdate", { status: "CANCELLED", rideId });
    }
    io.emit("rideGone", { rideId });
  }

  return updatedRide;
};

/**
 * Get ride history for rider (with pagination)
 */
const getRiderHistory = async (userId, options) => {
  const rider = await prisma.rider.findUnique({ where: { userId } });
  if (!rider) throw AppError.notFound("Rider profile not found");
  return rideRepo.findRidesByRider(rider.id, options);
};

/**
 * Get pending rides (for driver)
 */
const getPendingRides = async () => rideRepo.findPendingRides();

/**
 * Get driver's active ride
 */
const getDriverActiveRide = async (userId) => {
  const driver = await prisma.driver.findUnique({ where: { userId } });
  if (!driver) throw AppError.notFound("Driver profile not found");
  return rideRepo.findActiveRideByDriver(driver.id);
};

/**
 * Get driver earnings summary
 */
const getDriverEarnings = async (userId) => {
  const driver = await prisma.driver.findUnique({ where: { userId } });
  if (!driver) throw AppError.notFound("Driver profile not found");
  return rideRepo.getDriverEarnings(driver.id);
};

module.exports = {
  bookRide,
  getFareEstimate,
  acceptRide,
  rejectRide,
  verifyRideOTP,
  completeRide,
  cancelRide,
  getRiderHistory,
  getPendingRides,
  getDriverActiveRide,
  getDriverEarnings,
};
