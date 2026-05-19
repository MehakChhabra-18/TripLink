/**
 * Multer + Cloudinary Upload Middleware
 * Handles: profile images, driver licenses, RC documents, vehicle photos
 *
 * Flow:
 *   User sends multipart/form-data
 *     → Multer parses the file
 *     → multer-storage-cloudinary uploads directly to Cloudinary
 *     → req.file / req.files contains Cloudinary URLs (.path)
 *     → Controller saves URL into DB
 */
const multer           = require("multer");
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const cloudinary       = require("../config/cloudinary");
const { UPLOAD_LIMITS } = require("../constants");

// ─── Allowed MIME types ───────────────────────────────────────────────────────
const IMAGE_MIMES = ["image/jpeg", "image/png", "image/webp"];
const DOC_MIMES   = ["image/jpeg", "image/png", "application/pdf"];

// ─── Profile Image Upload ─────────────────────────────────────────────────────
// Route  : PATCH /api/v1/auth/profile/image
// Field  : "profileImage"  (form-data key)
// Saved  : User.profileImage  ← Cloudinary URL (triplink/profile-images/)
const uploadProfileImage = multer({
  storage: new CloudinaryStorage({
    cloudinary,
    params: {
      folder:          "triplink/profile-images",
      allowed_formats: ["jpg", "jpeg", "png", "webp"],
      transformation:  [{ width: 512, crop: "limit", quality: "auto" }],
    },
  }),
  limits:     { fileSize: UPLOAD_LIMITS.PROFILE_IMAGE }, // 5 MB
  fileFilter: (_req, file, cb) => {
    if (IMAGE_MIMES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Profile photo must be JPEG, PNG, or WebP"), false);
    }
  },
}).single("profileImage");

// ─── Driver Documents (3-in-1) Upload ────────────────────────────────────────
// Route  : POST /api/v1/driver/docs
// Fields : "licenseImage" | "rcDocument" | "vehicleImage"
//
// Each field goes to its OWN Cloudinary folder:
//   licenseImage  → triplink/driver-licenses/   → saved in Driver.licenseImage
//   rcDocument    → triplink/rc-documents/       → saved in Vehicle.rcDocument
//   vehicleImage  → triplink/vehicle-images/     → saved in Vehicle.vehicleImage
const uploadDriverDocs = multer({
  storage: new CloudinaryStorage({
    cloudinary,
    // params as a FUNCTION → gives each field its own folder
    params: (_req, file) => {
      const folderMap = {
        licenseImage: "driver-licenses",
        rcDocument:   "rc-documents",
        vehicleImage: "vehicle-images",
      };
      return {
        folder:          `triplink/${folderMap[file.fieldname] || "driver-docs"}`,
        allowed_formats: ["jpg", "jpeg", "png", "pdf"],
        transformation:  [{ width: 1024, crop: "limit", quality: "auto" }],
      };
    },
  }),
  limits:     { fileSize: UPLOAD_LIMITS.DOCUMENT }, // 10 MB
  fileFilter: (_req, file, cb) => {
    if (DOC_MIMES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(
        new Error(`"${file.fieldname}" must be JPEG, PNG, or PDF`),
        false
      );
    }
  },
}).fields([
  { name: "licenseImage", maxCount: 1 },
  { name: "rcDocument",   maxCount: 1 },
  { name: "vehicleImage", maxCount: 1 },
]);

module.exports = {
  uploadProfileImage,
  uploadDriverDocs,
};
