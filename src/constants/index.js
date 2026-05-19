/**
 * Application-wide constants
 */

const ROLES = Object.freeze({
  RIDER:  "RIDER",
  DRIVER: "DRIVER",
  ADMIN:  "ADMIN",
});

const RIDE_STATUS = Object.freeze({
  PENDING:   "PENDING",
  ACCEPTED:  "ACCEPTED",
  STARTED:   "STARTED",
  COMPLETED: "COMPLETED",
  CANCELLED: "CANCELLED",
  REJECTED:  "REJECTED",
});

const PAYMENT_STATUS = Object.freeze({
  PENDING:  "PENDING",
  PAID:     "PAID",
  FAILED:   "FAILED",
  REFUNDED: "REFUNDED",
});

const OTP_PURPOSE = Object.freeze({
  REGISTRATION:   "REGISTRATION",
  LOGIN:          "LOGIN",
  RIDE_START:     "RIDE_START",
  PASSWORD_RESET: "PASSWORD_RESET",
});

const OTP_TYPE = Object.freeze({
  EMAIL: "EMAIL",
  PHONE: "PHONE",
});

const VEHICLE_TYPE = Object.freeze({
  BIKE:    "BIKE",
  AUTO:    "AUTO",
  CAR:     "CAR",
  SUV:     "SUV",
  LUXURY:  "LUXURY",
});

const VERIFICATION_STATUS = Object.freeze({
  PENDING:  "PENDING",
  VERIFIED: "VERIFIED",
  REJECTED: "REJECTED",
});

// Pagination defaults
const PAGINATION = Object.freeze({
  DEFAULT_PAGE:  1,
  DEFAULT_LIMIT: 10,
  MAX_LIMIT:     100,
});

// OTP config
const OTP_CONFIG = Object.freeze({
  LENGTH:       6,
  EXPIRY_MIN:   10,    // minutes
  MAX_ATTEMPTS: 3,
  RESEND_DELAY: 60,    // seconds
});

// JWT cookie names
const COOKIE_NAMES = Object.freeze({
  REFRESH_TOKEN: "triplink_refresh",
});

// Upload limits
const UPLOAD_LIMITS = Object.freeze({
  PROFILE_IMAGE:  5  * 1024 * 1024, // 5 MB
  DOCUMENT:       10 * 1024 * 1024, // 10 MB
  VEHICLE_IMAGE:  8  * 1024 * 1024, // 8 MB
});

module.exports = {
  ROLES,
  RIDE_STATUS,
  PAYMENT_STATUS,
  OTP_PURPOSE,
  OTP_TYPE,
  VEHICLE_TYPE,
  VERIFICATION_STATUS,
  PAGINATION,
  OTP_CONFIG,
  COOKIE_NAMES,
  UPLOAD_LIMITS,
};
