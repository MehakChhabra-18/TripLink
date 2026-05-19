/**
 * Rate Limiter Middleware
 * Different limits for different endpoint types
 */
const rateLimit = require("express-rate-limit");

/**
 * General API rate limit: 100 req/15 min
 */
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max:      100,
  standardHeaders: true,
  legacyHeaders:   false,
  message: { success: false, message: "Too many requests. Please try again later.", code: "RATE_LIMIT_EXCEEDED" },
});

/**
 * Auth endpoints: 10 req/15 min (stricter for brute-force protection)
 */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max:      10,
  standardHeaders: true,
  legacyHeaders:   false,
  message: { success: false, message: "Too many auth attempts. Please try again in 15 minutes.", code: "AUTH_RATE_LIMIT_EXCEEDED" },
});

/**
 * OTP resend: 3 req/10 min
 */
const otpLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max:      3,
  standardHeaders: true,
  legacyHeaders:   false,
  message: { success: false, message: "Too many OTP requests. Please wait before requesting again.", code: "OTP_RATE_LIMIT_EXCEEDED" },
});

module.exports = { apiLimiter, authLimiter, otpLimiter };
