/**
 * Driver Routes
 * Profile, vehicle management, availability, document uploads
 */
const router = require("express").Router();
const prisma  = require("../config/prisma");
const asyncHandler = require("../utils/asyncHandler");
const { sendSuccess, sendError } = require("../utils/response");
const { authenticate, authorize } = require("../middleware/auth.middleware");
const { uploadDriverDocs } = require("../middleware/upload.middleware");
const { deleteFromCloudinary } = require("../utils/cloudinary");
const { ROLES } = require("../constants");

// All driver routes require authentication + DRIVER role
router.use(authenticate, authorize(ROLES.DRIVER));

// ─── GET /api/v1/driver/profile ───────────────────────────────────────────────
router.get("/profile", asyncHandler(async (req, res) => {
  const driver = await prisma.driver.findUnique({
    where:   { userId: req.user.id },
    include: {
      user:     { select: { id: true, name: true, email: true, phone: true, profileImage: true } },
      vehicles: { where: { isActive: true } },
    },
  });

  if (!driver) return sendError(res, 404, "Driver profile not found");
  sendSuccess(res, 200, "Driver profile", { driver });
}));

// ─── PATCH /api/v1/driver/availability ───────────────────────────────────────
// Toggle driver online/offline
router.patch("/availability", asyncHandler(async (req, res) => {
  const { isAvailable } = req.body;

  const driver = await prisma.driver.update({
    where: { userId: req.user.id },
    data:  { isAvailable: Boolean(isAvailable), isOnline: Boolean(isAvailable) },
  });

  // Notify all connected clients via Socket.IO
  const io = req.app.get("io");
  if (io) {
    io.emit("driver-status-change", { driverId: req.user.id, isAvailable: driver.isAvailable });
  }

  sendSuccess(res, 200, `You are now ${driver.isAvailable ? "online" : "offline"}`, {
    isAvailable: driver.isAvailable,
  });
}));

// ─── POST /api/v1/driver/vehicle ──────────────────────────────────────────────
// Add a new vehicle
router.post("/vehicle", asyncHandler(async (req, res) => {
  const { vehicleType, make, model, year, color, licensePlate } = req.body;

  const driver = await prisma.driver.findUnique({ where: { userId: req.user.id } });
  if (!driver) return sendError(res, 404, "Driver profile not found");

  const vehicle = await prisma.vehicle.create({
    data: {
      driverId: driver.id,
      vehicleType: vehicleType || "CAR",
      make, model,
      year:         parseInt(year),
      color,
      licensePlate,
    },
  });

  sendSuccess(res, 201, "Vehicle added", { vehicle });
}));

// ─── GET /api/v1/driver/vehicles ─────────────────────────────────────────────
// List driver's vehicles
router.get("/vehicles", asyncHandler(async (req, res) => {
  const driver = await prisma.driver.findUnique({ where: { userId: req.user.id } });
  if (!driver) return sendError(res, 404, "Driver profile not found");

  const vehicles = await prisma.vehicle.findMany({
    where: { driverId: driver.id, isActive: true },
  });

  sendSuccess(res, 200, "Vehicles list", { vehicles });
}));

// ─── POST /api/v1/driver/docs ─────────────────────────────────────────────────
// Upload license + RC + vehicle image (multipart/form-data)
//
// Required body fields:
//   vehicleId     (String)  - ID of driver's vehicle (needed for RC & vehicle image)
// Required file fields (at least one):
//   licenseImage  → saved in Driver.licenseImage   (Cloudinary: driver-licenses/)
//   rcDocument    → saved in Vehicle.rcDocument    (Cloudinary: rc-documents/)
//   vehicleImage  → saved in Vehicle.vehicleImage  (Cloudinary: vehicle-images/)
router.post("/docs", (req, res, next) => {
  uploadDriverDocs(req, res, (err) => {
    if (err) return next(err);
    next();
  });
}, asyncHandler(async (req, res) => {
  const driver = await prisma.driver.findUnique({ where: { userId: req.user.id } });
  if (!driver) return sendError(res, 404, "Driver profile not found");

  const hasVehicleDocs = req.files?.rcDocument?.[0] || req.files?.vehicleImage?.[0];

  // vehicleId is required if uploading RC or vehicle image
  if (hasVehicleDocs && !req.body.vehicleId) {
    return sendError(res, 400, "vehicleId is required when uploading RC document or vehicle image");
  }

  // ── 1. Update licenseImage → delete old from Cloudinary, save new URL ────
  if (req.files?.licenseImage?.[0]) {
    await deleteFromCloudinary(driver.licenseImage); // delete old file
    await prisma.driver.update({
      where: { id: driver.id },
      data:  { licenseImage: req.files.licenseImage[0].path },
    });
  }

  // ── 2. Update rcDocument + vehicleImage → delete old, save new ───────────
  if (req.body.vehicleId && hasVehicleDocs) {
    // Verify vehicle belongs to this driver
    const vehicle = await prisma.vehicle.findFirst({
      where: { id: req.body.vehicleId, driverId: driver.id },
    });
    if (!vehicle) return sendError(res, 404, "Vehicle not found or does not belong to you");

    const vehicleUpdate = {};
    if (req.files?.rcDocument?.[0]) {
      await deleteFromCloudinary(vehicle.rcDocument);   // delete old RC
      vehicleUpdate.rcDocument = req.files.rcDocument[0].path;
    }
    if (req.files?.vehicleImage?.[0]) {
      await deleteFromCloudinary(vehicle.vehicleImage); // delete old vehicle image
      vehicleUpdate.vehicleImage = req.files.vehicleImage[0].path;
    }

    await prisma.vehicle.update({
      where: { id: req.body.vehicleId },
      data:  vehicleUpdate,
    });
  }

  sendSuccess(res, 200, "Documents uploaded successfully", {
    licenseImage: req.files?.licenseImage?.[0]?.path || null,
    rcDocument:   req.files?.rcDocument?.[0]?.path   || null,
    vehicleImage: req.files?.vehicleImage?.[0]?.path || null,
  });
}));

// ─── GET /api/v1/driver/stats ─────────────────────────────────────────────────
// Total rides, earnings, rating
router.get("/stats", asyncHandler(async (req, res) => {
  const driver = await prisma.driver.findUnique({
    where:  { userId: req.user.id },
    select: { totalRides: true, totalEarnings: true, rating: true, verificationStatus: true },
  });

  if (!driver) return sendError(res, 404, "Driver profile not found");
  sendSuccess(res, 200, "Driver stats", { stats: driver });
}));

module.exports = router;
