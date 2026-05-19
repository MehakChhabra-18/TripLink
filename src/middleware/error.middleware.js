/**
 * Global Error Handler Middleware
 * Converts AppError and unexpected errors into standardized JSON responses
 * Must be registered LAST in Express middleware stack
 */
const AppError = require("../utils/AppError");

/**
 * @param {Error} err
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 * @param {import("express").NextFunction} next
 */
const errorHandler = (err, req, res, next) => {
  // Default to 500
  let statusCode = 500;
  let message    = "Internal server error";
  let code       = "INTERNAL_ERROR";
  let details    = null;

  // Known operational errors (thrown intentionally)
  if (err instanceof AppError && err.isOperational) {
    statusCode = err.statusCode;
    message    = err.message;
    code       = err.code;
    details    = err.details;
  }

  // Prisma errors
  else if (err.code === "P2002") {
    // Unique constraint violation
    statusCode = 409;
    message    = "A record with this value already exists";
    code       = "DUPLICATE_ENTRY";
    details    = err.meta?.target;
  } else if (err.code === "P2025") {
    // Record not found
    statusCode = 404;
    message    = "Record not found";
    code       = "NOT_FOUND";
  } else if (err.code === "P2003") {
    // Foreign key constraint
    statusCode = 400;
    message    = "Related record not found";
    code       = "FOREIGN_KEY_ERROR";
  }

  // JWT errors
  else if (err.name === "JsonWebTokenError") {
    statusCode = 401;
    message    = "Invalid token";
    code       = "INVALID_TOKEN";
  } else if (err.name === "TokenExpiredError") {
    statusCode = 401;
    message    = "Token expired";
    code       = "TOKEN_EXPIRED";
  }

  // Multer errors
  else if (err.code === "LIMIT_FILE_SIZE") {
    statusCode = 413;
    message    = "File is too large";
    code       = "FILE_TOO_LARGE";
  } else if (err.code === "LIMIT_UNEXPECTED_FILE") {
    statusCode = 400;
    message    = "Unexpected file field";
    code       = "UNEXPECTED_FILE";
  }

  // Log unexpected errors
  if (statusCode === 500) {
    console.error("🔴 Unhandled error:", {
      message: err.message,
      stack:   process.env.NODE_ENV === "development" ? err.stack : undefined,
    });
  }

  return res.status(statusCode).json({
    success: false,
    message,
    code,
    ...(details && { details }),
    ...(process.env.NODE_ENV === "development" && statusCode === 500 && {
      stack: err.stack,
    }),
  });
};

/**
 * 404 Not Found handler — register before errorHandler
 */
const notFound = (req, res, next) => {
  next(AppError.notFound(`Route not found: ${req.method} ${req.originalUrl}`));
};

module.exports = { errorHandler, notFound };
