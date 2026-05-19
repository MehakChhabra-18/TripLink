/**
 * TripLink Server Entry Point
 * Sets up HTTP server, Socket.IO, and database connections
 */
require("dotenv").config();

const { validateEnv }    = require("./config/env");
const { verifyMailer }   = require("./config/mailer");

// Validate required environment variables before starting
validateEnv();

const http = require("http");
const { Server } = require("socket.io");

const app    = require("./app");
const prisma = require("./config/prisma");
const { initSocket } = require("./sockets");

const PORT = process.env.PORT || 3000;

// ─── HTTP Server ───────────────────────────────────────────────────────────────
const server = http.createServer(app);

// ─── Socket.IO ────────────────────────────────────────────────────────────────
const io = new Server(server, {
  cors: {
    origin: (origin, callback) => {
      const allowed = [
        process.env.FRONTEND_URL,
        "http://localhost:3000",
        "http://localhost:5173",
        "http://localhost:5174",
        "https://triplink-wkz0.onrender.com"
      ].filter(Boolean);

      if (!origin || origin === "null" || allowed.includes(origin) || origin.includes("onrender.com") || origin.includes("localhost")) {
        return callback(null, true);
      }
      callback(new Error(`CORS blocked: ${origin}`));
    },
    methods:     ["GET", "POST"],
    credentials: true,
  },
  // Reconnection ping interval
  pingInterval: 10000,
  pingTimeout:  5000,
});

// Make io accessible from controllers via app.get("io")
app.set("io", io);

// Initialize all socket handlers
initSocket(io);

// ─── Startup ───────────────────────────────────────────────────────────────────
const start = async () => {
  try {
    // 1. Connect PostgreSQL (required — blocks startup)
    await prisma.$connect();
    console.log("✅ PostgreSQL (Prisma) connected");

    // 2. Start HTTP server IMMEDIATELY so Render detects the open port
    server.listen(PORT, "0.0.0.0", () => {
      console.log("");
      console.log("🚗  TripLink Backend v2.0 — Production Architecture");
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      console.log(`🌐  HTTP Server   : http://0.0.0.0:${PORT}`);
      console.log(`📡  Socket.IO     : ready`);
      console.log(`🗄️   PostgreSQL    : connected`);
      console.log(`🔒  Auth          : JWT + Refresh Tokens`);
      console.log(`💳  Razorpay      : ${process.env.RAZORPAY_KEY_ID ? "configured" : "not configured"}`);
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      console.log("");
    });

    // 3. Non-critical: connect mailer in background
    verifyMailer().catch((err) =>
      console.warn("⚠️  Mailer skipped:", err.message)
    );

  } catch (err) {
    console.error("❌ Server startup failed:", err.message);
    process.exit(1);
  }
};


// ─── Graceful Shutdown ────────────────────────────────────────────────────────
const shutdown = async (signal) => {
  console.log(`\n⚠️  ${signal} received — shutting down gracefully...`);
  
  server.close(async () => {
    await prisma.$disconnect();
    console.log("✅ Shutdown complete");
    process.exit(0);
  });

  // Force exit after 10s
  setTimeout(() => {
    console.error("❌ Forced shutdown after timeout");
    process.exit(1);
  }, 10000);
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT",  () => shutdown("SIGINT"));

// ─── Unhandled Rejections ────────────────────────────────────────────────────
process.on("unhandledRejection", (err) => {
  console.error("🔴 Unhandled Promise Rejection:", err);
  // Don't crash in production — log and continue
});

process.on("uncaughtException", (err) => {
  console.error("🔴 Uncaught Exception:", err);
  // Fatal — must restart
  process.exit(1);
});

start();
