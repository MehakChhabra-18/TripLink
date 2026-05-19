const express        = require("express");
const router         = express.Router();
const rideController = require("../controllers/rideController");
const { sessionAuth, dualAuth } = require("../middleware/auth");

// ─── Fare Estimate (GET) — used by both EJS and React ─────────────────────────
// GET /ride/fare?pickup=Delhi&destination=Noida
// GET /api/v1/ride/fare?pickup=Delhi&destination=Noida
router.get("/fare", rideController.getFare);

// ─── Book Ride (POST) ─────────────────────────────────────────────────────────
// POST /ride/book         → EJS form submission
// POST /api/v1/ride/book  → React JSON request
router.post("/book", dualAuth, rideController.bookRide);

// ─── Update Ride Status ───────────────────────────────────────────────────────
// PUT /api/v1/ride/:id/status  body: { status: "accepted"|"started"|"completed"|"cancelled"|"rejected" }
router.put("/:id/status", dualAuth, rideController.updateRideStatus);

// ─── Verify Ride-Start OTP ────────────────────────────────────────────────────
// POST /api/v1/ride/verify-otp  body: { rideId, otp }
router.post("/verify-otp", dualAuth, rideController.verifyOTP);

// ─── Get Ride History (rider) ─────────────────────────────────────────────────
// GET /api/v1/ride/history
router.get("/history", dualAuth, rideController.getRideHistory);

// ─── Get Pending Rides (driver) ───────────────────────────────────────────────
// GET /api/v1/ride/pending
router.get("/pending", dualAuth, rideController.getPendingRides);

// ─── Get Active Ride (driver — currently accepted/started) ───────────────────
// GET /api/v1/ride/active
router.get("/active", dualAuth, rideController.getActiveRide);

module.exports = router;