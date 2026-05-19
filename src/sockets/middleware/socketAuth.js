/**
 * Socket Authentication Middleware
 * Verifies JWT token on socket connection
 */
const { verifyAccessToken } = require("../../utils/jwt");

/**
 * @param {import("socket.io").Socket} socket
 * @param {Function} next
 */
const socketAuth = (socket, next) => {
  // Token can be passed as auth: { token: "..." } or query: ?token=...
  const token =
    socket.handshake.auth?.token ||
    socket.handshake.query?.token;

  if (!token) {
    // Allow unauthenticated connections (optional auth)
    socket.userId = null;
    socket.userRole = null;
    return next();
  }

  try {
    const decoded    = verifyAccessToken(token);
    socket.userId    = decoded.id;
    socket.userRole  = decoded.role;
    next();
  } catch {
    // Still allow connection but without auth (for backward compat)
    socket.userId   = null;
    socket.userRole = null;
    next();
  }
};

module.exports = { socketAuth };
