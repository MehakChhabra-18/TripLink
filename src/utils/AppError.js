/**
 * Custom Application Error class
 * Provides structured errors with HTTP status codes
 */
class AppError extends Error {
  /**
   * @param {string}  message    - Human-readable error message
   * @param {number}  statusCode - HTTP status code (default 500)
   * @param {string}  code       - App-level error code e.g. "INVALID_OTP"
   * @param {any}     [details]  - Optional extra context
   */
  constructor(message, statusCode = 500, code = "INTERNAL_ERROR", details = null) {
    super(message);
    this.name       = "AppError";
    this.statusCode = statusCode;
    this.code       = code;
    this.details    = details;
    this.isOperational = true; // distinguishes from programmer errors

    // Capture stack in development
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

// ─── Common factory methods ────────────────────────────────────────────────────

AppError.badRequest = (msg, code, details) =>
  new AppError(msg, 400, code || "BAD_REQUEST", details);

AppError.unauthorized = (msg = "Authentication required") =>
  new AppError(msg, 401, "UNAUTHORIZED");

AppError.forbidden = (msg = "Access denied") =>
  new AppError(msg, 403, "FORBIDDEN");

AppError.notFound = (msg = "Resource not found") =>
  new AppError(msg, 404, "NOT_FOUND");

AppError.conflict = (msg, code, details) =>
  new AppError(msg, 409, code || "CONFLICT", details);

AppError.internal = (msg = "Internal server error") =>
  new AppError(msg, 500, "INTERNAL_ERROR");

module.exports = AppError;
