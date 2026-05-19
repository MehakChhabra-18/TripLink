/**
 * Authentication & Authorization Middleware
 * 
 * authenticate  → verifies JWT access token
 * authorize     → role-based access guard
 * optionalAuth  → attaches user if token present, doesn't fail if absent
 */
const { verifyAccessToken } = require("../utils/jwt");
const AppError = require("../utils/AppError");
const asyncHandler = require("../utils/asyncHandler");
const prisma = require("../config/prisma");

/**
 * Require valid JWT access token
 * Attaches decoded payload to req.user
 */
const authenticate = asyncHandler(async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw AppError.unauthorized("No access token provided");
  }

  const token = authHeader.split(" ")[1];

  let decoded;
  try {
    decoded = verifyAccessToken(token);
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      throw AppError.unauthorized("Access token expired. Please refresh.");
    }
    throw AppError.unauthorized("Invalid access token");
  }

  // Ensure user still exists and is active
  const user = await prisma.user.findUnique({
    where: { id: decoded.id },
    select: { id: true, role: true, isActive: true },
  });

  if (!user || !user.isActive) {
    throw AppError.unauthorized("Account not found or deactivated");
  }

  req.user = { id: user.id, role: user.role };
  next();
});

/**
 * Role-based authorization guard
 * @param {...string} roles - Allowed roles e.g. "RIDER", "DRIVER", "ADMIN"
 */
const authorize = (...roles) =>
  asyncHandler(async (req, res, next) => {
    if (!req.user) {
      throw AppError.unauthorized();
    }
    if (!roles.includes(req.user.role)) {
      throw AppError.forbidden(`Access denied. Required role: ${roles.join(" or ")}`);
    }
    next();
  });

/**
 * Optional authentication — doesn't throw if token is missing/invalid
 * Useful for endpoints that behave differently for logged-in users
 */
const optionalAuth = asyncHandler(async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return next();
  }

  try {
    const token   = authHeader.split(" ")[1];
    const decoded = verifyAccessToken(token);
    const user    = await prisma.user.findUnique({
      where:  { id: decoded.id },
      select: { id: true, role: true, isActive: true },
    });
    if (user && user.isActive) {
      req.user = { id: user.id, role: user.role };
    }
  } catch {
    // Silently ignore invalid tokens for optional auth
  }

  next();
});

module.exports = { authenticate, authorize, optionalAuth };
