const express        = require("express");
const router         = express.Router();
const rideController = require("../controllers/rideController");
const { sessionAuth, requireRole } = require("../middleware/auth");

// ─── RIDER DASHBOARD (EJS SSR) ────────────────────────────────────────────────
// GET /rider/dashboard
router.get("/dashboard", sessionAuth, requireRole("rider"), rideController.getRiderDashboard);

module.exports = router;