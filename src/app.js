/**
 * Express Application Setup
 * Production-grade TripLink backend
 */
require("dotenv").config();

const express      = require("express");
const cors         = require("cors");
const helmet       = require("helmet");
const cookieParser = require("cookie-parser");
const path         = require("path");

const { apiLimiter }   = require("./middleware/rateLimit.middleware");
const { errorHandler, notFound } = require("./middleware/error.middleware");

// ─── Route imports ─────────────────────────────────────────────────────────────
const authRoutes    = require("./routes/auth.routes");
const rideRoutes    = require("./routes/ride.routes");
const paymentRoutes = require("./routes/payment.routes");
const driverRoutes  = require("./routes/driver.routes");
const riderRoutes   = require("./routes/rider.routes");
const adminRoutes   = require("./routes/admin.routes");

// ─── Create Express app ───────────────────────────────────────────────────────
const app = express();

// ─── Security Headers (Helmet) ────────────────────────────────────────────────
app.use(helmet({
  crossOriginEmbedderPolicy: false, // Allow Cloudinary images
  contentSecurityPolicy:     false, // Configured separately if needed
}));

// ─── CORS ──────────────────────────────────────────────────────────────────────
const allowedOrigins = [
  process.env.ALLOWED_ORIGIN || "http://localhost:3000",
  "http://localhost:3000",
];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    callback(new Error(`CORS blocked: ${origin}`));
  },
  credentials:    true,
  methods:        ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
}));

// ─── Core Middleware ──────────────────────────────────────────────────────────
app.use(cookieParser());
app.use(express.urlencoded({ extended: true }));

// JSON body parser (skip for webhook route — it needs raw body)
app.use((req, res, next) => {
  if (req.originalUrl === "/api/v1/payments/webhook") {
    return next(); // Skip JSON parsing for webhooks
  }
  express.json()(req, res, next);
});

// ─── Static Files ─────────────────────────────────────────────────────────────
app.use(express.static(path.join(__dirname, "../public")));

// ─── Apply global rate limit ───────────────────────────────────────────────────
app.use("/api/", apiLimiter);

// ─── Health Check ─────────────────────────────────────────────────────────────
app.get("/api/health", (req, res) => {
  res.json({
    status:    "ok",
    service:   "TripLink API",
    version:   "2.0.0",
    timestamp: new Date().toISOString(),
    uptime:    process.uptime(),
  });
});

// ─── Root Route ───────────────────────────────────────────────────────────────
app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Welcome to TripLink Backend API 🚀",
    docs: "/api/health",
  });
});

// ─── API Routes ────────────────────────────────────────────────────────────────
app.use("/api/v1/auth",     authRoutes);
app.use("/api/v1/rides",    rideRoutes);
app.use("/api/v1/payments", paymentRoutes);
app.use("/api/v1/driver",   driverRoutes);
app.use("/api/v1/rider",    riderRoutes);
app.use("/api/v1/admin",    adminRoutes);

// ─── Store io on app for controllers ──────────────────────────────────────────
// io is set via app.set("io", io) in server.js

// ─── 404 → Error handler ──────────────────────────────────────────────────────
app.use(notFound);
app.use(errorHandler);

module.exports = app;
