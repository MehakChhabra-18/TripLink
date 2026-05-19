/**
 * Ride Controller
 * Handles req/res — delegates to ride.service
 */
const rideService = require("../services/ride.service");
const asyncHandler = require("../utils/asyncHandler");
const { sendSuccess } = require("../utils/response");
const { buildMeta } = require("../utils/response");

// ─── GET /api/v1/rides/fare-estimate ──────────────────────────────────────────
const getFareEstimate = asyncHandler(async (req, res) => {
  const { pickup, destination } = req.query;
  const estimate = rideService.getFareEstimate(pickup, destination);
  sendSuccess(res, 200, "Fare estimate", estimate);
});

// ─── POST /api/v1/rides ───────────────────────────────────────────────────────
const bookRide = asyncHandler(async (req, res) => {
  const io   = req.app.get("io");
  const ride = await rideService.bookRide(req.user.id, req.body, io);
  sendSuccess(res, 201, "Ride booked successfully", { ride });
});

// ─── GET /api/v1/rides/pending ────────────────────────────────────────────────
const getPendingRides = asyncHandler(async (req, res) => {
  const rides = await rideService.getPendingRides();
  sendSuccess(res, 200, "Pending rides", { rides });
});

// ─── POST /api/v1/rides/:id/accept ───────────────────────────────────────────
const acceptRide = asyncHandler(async (req, res) => {
  const io   = req.app.get("io");
  const ride = await rideService.acceptRide(req.user.id, req.params.id, io);
  sendSuccess(res, 200, "Ride accepted", { ride });
});

// ─── POST /api/v1/rides/:id/reject ───────────────────────────────────────────
const rejectRide = asyncHandler(async (req, res) => {
  const io   = req.app.get("io");
  const ride = await rideService.rejectRide(req.user.id, req.params.id, io);
  sendSuccess(res, 200, "Ride rejected", { ride });
});

// ─── POST /api/v1/rides/:id/verify-otp ───────────────────────────────────────
const verifyRideOTP = asyncHandler(async (req, res) => {
  const io   = req.app.get("io");
  const ride = await rideService.verifyRideOTP(
    req.user.id, req.params.id, req.body.otp, io
  );
  sendSuccess(res, 200, "OTP verified. Ride started!", { ride });
});

// ─── POST /api/v1/rides/:id/complete ─────────────────────────────────────────
const completeRide = asyncHandler(async (req, res) => {
  const io   = req.app.get("io");
  const ride = await rideService.completeRide(req.user.id, req.params.id, io);
  sendSuccess(res, 200, "Ride completed", { ride });
});

// ─── POST /api/v1/rides/:id/cancel ───────────────────────────────────────────
const cancelRide = asyncHandler(async (req, res) => {
  const io   = req.app.get("io");
  const ride = await rideService.cancelRide(req.user.id, req.params.id, io);
  sendSuccess(res, 200, "Ride cancelled", { ride });
});

// ─── GET /api/v1/rides/history ────────────────────────────────────────────────
const getRideHistory = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, status } = req.query;
  const { rides, total } = await rideService.getRiderHistory(req.user.id, {
    page: Number(page), limit: Number(limit), status,
  });

  sendSuccess(
    res, 200, "Ride history",
    { rides },
    buildMeta(total, Number(page), Number(limit))
  );
});

// ─── GET /api/v1/rides/active ─────────────────────────────────────────────────
const getActiveRide = asyncHandler(async (req, res) => {
  const ride = await rideService.getDriverActiveRide(req.user.id);
  sendSuccess(res, 200, "Active ride", { ride });
});

// ─── GET /api/v1/rides/earnings ───────────────────────────────────────────────
const getEarnings = asyncHandler(async (req, res) => {
  const earnings = await rideService.getDriverEarnings(req.user.id);
  sendSuccess(res, 200, "Driver earnings", earnings);
});

module.exports = {
  getFareEstimate, bookRide, getPendingRides, acceptRide, rejectRide,
  verifyRideOTP, completeRide, cancelRide, getRideHistory, getActiveRide, getEarnings,
};
