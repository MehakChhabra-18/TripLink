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
  process.env.ALLOWED_ORIGIN,
  "http://localhost:3000",
  "https://triplink-wkz0.onrender.com",
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, Postman, etc.) or same-origin / local / render deployments
    if (!origin || origin === "null" || allowedOrigins.includes(origin) || origin.includes("onrender.com") || origin.includes("localhost")) {
      return callback(null, true);
    }
    callback(new Error(`CORS blocked: ${origin}`));
  },
  credentials:    true,
  methods:        ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
}));

// ─── EJS View Engine & Session ──────────────────────────────────────────────────
const session = require("express-session");

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "../views"));

app.use(session({
  secret: process.env.JWT_SECRET || "fallback_secret",
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 7 * 24 * 60 * 60 * 1000 }
}));

// ─── Core Middleware ──────────────────────────────────────────────────────────
app.use(cookieParser());
app.use(express.urlencoded({ extended: true }));

// JSON body parser (skip for webhook route — it needs raw body)
app.use((req, res, next) => {
  if (req.originalUrl === "/api/v1/payments/webhook") {
    return next();
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

// ─── API Routes (v2) ──────────────────────────────────────────────────────────
app.use("/api/v1/auth",     authRoutes);
app.use("/api/v1/rides",    rideRoutes);
app.use("/api/v1/payments", paymentRoutes);
app.use("/api/v1/driver",   driverRoutes);
app.use("/api/v1/rider",    riderRoutes);
app.use("/api/v1/admin",    adminRoutes);

// ─── FRONTEND ROUTES (v1 EJS) ─────────────────────────────────────────────────
const frontendAuthRoutes = require("../routes/auth");
const frontendRiderRoutes = require("../routes/rider");
const frontendDriverRoutes = require("../routes/driver");
const frontendRideRoutes = require("../routes/ride");
const frontendPaymentRoutes = require("../routes/payment");

app.get("/", (req, res) => res.render("home", { user: req.session?.user || null }));
app.use("/auth", frontendAuthRoutes);
app.use("/rider", frontendRiderRoutes);
app.use("/driver", frontendDriverRoutes);
app.use("/ride", frontendRideRoutes);
app.use("/payment", frontendPaymentRoutes);

// Compatibility aliases for EJS frontend scripts
app.use("/api/v1/ride", frontendRideRoutes);
app.use("/api/v1/payment", frontendPaymentRoutes);

// ─── Store io on app for controllers ──────────────────────────────────────────
// io is set via app.set("io", io) in server.js

// ─── 404 → Error handler ──────────────────────────────────────────────────────
app.use(notFound);
app.use(errorHandler);

module.exports = app;
