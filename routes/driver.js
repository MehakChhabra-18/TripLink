const express           = require("express");
const router            = express.Router();
const driverController  = require("../controllers/driverController");
const rideController    = require("../controllers/rideController");
const { sessionAuth, dualAuth, requireRole } = require("../middleware/auth");

// ─── EJS SSR Dashboard ────────────────────────────────────────────────────────
router.get("/dashboard", sessionAuth, requireRole("driver"), driverController.getDashboard);

// ─── Toggle Availability ──────────────────────────────────────────────────────
router.post("/toggleAvailability", sessionAuth, requireRole("driver"), driverController.toggleAvailability);

// ─── Accept Ride (EJS form POST) ─────────────────────────────────────────────
// Also mapped to PUT /api/v1/ride/:id/status for React
router.post("/accept/:id", sessionAuth, requireRole("driver"), async (req, res) => {
  req.body.status = "accepted";
  req.params.id   = req.params.id;
  return rideController.updateRideStatus(req, res);
});

// ─── Reject Ride (EJS form POST) ─────────────────────────────────────────────
router.post("/reject/:id", sessionAuth, requireRole("driver"), async (req, res) => {
  req.body.status = "rejected";
  return rideController.updateRideStatus(req, res);
});

// ─── API: Driver Stats ────────────────────────────────────────────────────────
router.get("/stats", dualAuth, requireRole("driver"), driverController.getStats);

module.exports = router;