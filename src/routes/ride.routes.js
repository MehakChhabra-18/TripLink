/**
 * Ride Routes
 */
const router = require("express").Router();
const rideController = require("../controllers/ride.controller");
const { authenticate, authorize } = require("../middleware/auth.middleware");
const { validate } = require("../middleware/validate.middleware");
const {
  bookRideSchema,
  verifyRideOTPSchema,
  getRideHistorySchema,
} = require("../validations/ride.validation");
const { ROLES } = require("../constants");

// ─── Public ───────────────────────────────────────────────────────────────────
router.get("/fare-estimate", rideController.getFareEstimate);

// ─── Rider Routes ─────────────────────────────────────────────────────────────
router.post("/",
  authenticate, authorize(ROLES.RIDER),
  validate(bookRideSchema),
  rideController.bookRide
);

router.get("/history",
  authenticate, authorize(ROLES.RIDER),
  validate(getRideHistorySchema, "query"),
  rideController.getRideHistory
);

router.post("/:id/cancel",
  authenticate,
  rideController.cancelRide
);

// ─── Driver Routes ────────────────────────────────────────────────────────────
router.get("/pending",
  authenticate, authorize(ROLES.DRIVER),
  rideController.getPendingRides
);

router.get("/active",
  authenticate, authorize(ROLES.DRIVER),
  rideController.getActiveRide
);

router.get("/earnings",
  authenticate, authorize(ROLES.DRIVER),
  rideController.getEarnings
);

router.post("/:id/accept",
  authenticate, authorize(ROLES.DRIVER),
  rideController.acceptRide
);

router.post("/:id/reject",
  authenticate, authorize(ROLES.DRIVER),
  rideController.rejectRide
);

router.post("/:id/verify-otp",
  authenticate, authorize(ROLES.DRIVER),
  rideController.verifyRideOTP
);

router.post("/:id/complete",
  authenticate, authorize(ROLES.DRIVER),
  rideController.completeRide
);

module.exports = router;
