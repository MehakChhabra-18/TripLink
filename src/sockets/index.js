/**
 * Main Socket.IO initialization
 * Wires all handlers and manages connection lifecycle
 */
const { socketAuth }              = require("./middleware/socketAuth");
const { registerTrackingHandlers } = require("./handlers/tracking.handler");

// Track connected sockets per user (for multi-device support)
const userSocketMap = new Map(); // userId → Set<socketId>

/**
 * @param {import("socket.io").Server} io
 */
const initSocket = (io) => {
  // Apply auth middleware to all connections
  io.use(socketAuth);

  io.on("connection", (socket) => {
    console.log(`🟢 Socket connected: ${socket.id} | user: ${socket.userId || "guest"}`);

    // ── User joins their personal room ─────────────────────────────────────
    // Supports both authenticated (auto-join) and manual join
    const joinRoom = (userId) => {
      if (!userId) return;
      socket.join(userId);

      // Track user→socket mapping
      if (!userSocketMap.has(userId)) {
        userSocketMap.set(userId, new Set());
      }
      userSocketMap.get(userId).add(socket.id);

      console.log(`👤 User ${userId} joined room`);
    };

    // Auto-join if authenticated
    if (socket.userId) joinRoom(socket.userId);

    // Manual join (for backward compat with frontend)
    socket.on("join", joinRoom);

    // ── Driver availability ────────────────────────────────────────────────
    socket.on("driver-availability", (data) => {
      // data: { driverId, isAvailable }
      io.emit("driver-status-change", data);
    });

    // ── Register tracking handlers ─────────────────────────────────────────
    registerTrackingHandlers(io, socket);

    // ── Disconnect cleanup ─────────────────────────────────────────────────
    socket.on("disconnect", (reason) => {
      console.log(`🔴 Socket disconnected: ${socket.id} | reason: ${reason}`);

      if (socket.userId) {
        const sockets = userSocketMap.get(socket.userId);
        if (sockets) {
          sockets.delete(socket.id);
          if (sockets.size === 0) {
            userSocketMap.delete(socket.userId);
            // Notify others this user is offline
            io.emit("user-offline", { userId: socket.userId });
          }
        }
      }
    });
  });
};

/**
 * Get all socket IDs for a user
 * @param {string} userId
 */
const getUserSockets = (userId) => userSocketMap.get(userId) || new Set();

/**
 * Check if a user is online
 * @param {string} userId
 */
const isUserOnline = (userId) => userSocketMap.has(userId);

module.exports = { initSocket, getUserSockets, isUserOnline };
