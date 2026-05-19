/**
 * Auth Routes
 * Routes only define endpoints and wire middleware + controllers
 */
const router = require("express").Router();
const authController = require("../controllers/auth.controller");
const { authenticate } = require("../middleware/auth.middleware");
const { validate } = require("../middleware/validate.middleware");
const { authLimiter, otpLimiter } = require("../middleware/rateLimit.middleware");
const {
  registerSchema,
  loginSchema,
  verifyOTPSchema,
  resendOTPSchema,
} = require("../validations/auth.validation");
const { uploadProfileImage } = require("../middleware/upload.middleware");
const { deleteFromCloudinary } = require("../utils/cloudinary");

// ─── Public Routes ────────────────────────────────────────────────────────────
router.post("/register",
  authLimiter,
  validate(registerSchema),
  authController.register
);

router.post("/login",
  authLimiter,
  validate(loginSchema),
  authController.login
);

router.post("/refresh",
  authController.refreshToken
);

router.post("/verify-otp",
  validate(verifyOTPSchema),
  authController.verifyOTP
);

router.post("/resend-otp",
  otpLimiter,
  validate(resendOTPSchema),
  authController.resendOTP
);

// ─── Protected Routes ─────────────────────────────────────────────────────────
router.post("/logout",
  authenticate,
  authController.logout
);

router.get("/me",
  authenticate,
  authController.getMe
);

// ─── Profile Image Upload ──────────────────────────────────────────────────────
router.patch("/profile/image",
  authenticate,
  (req, res, next) => {
    uploadProfileImage(req, res, (err) => {
      if (err) return next(err);
      next();
    });
  },
  require("../utils/asyncHandler")(async (req, res) => {
    const { sendError, sendSuccess } = require("../utils/response");
    const authRepo = require("../repositories/auth.repository");

    if (!req.file) return sendError(res, 400, "No image uploaded");

    // Delete OLD profile image from Cloudinary (if exists)
    const currentUser = await authRepo.findUserById(req.user.id);
    await deleteFromCloudinary(currentUser?.profileImage);

    // Save new Cloudinary URL to DB
    await authRepo.updateProfileImage(req.user.id, req.file.path);

    sendSuccess(res, 200, "Profile image updated", { imageUrl: req.file.path });
  })
);

module.exports = router;
