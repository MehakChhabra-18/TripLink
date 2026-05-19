const express    = require("express");
const session    = require("express-session");
const MongoStore = require("connect-mongo");
const cors       = require("cors");
const path       = require("path");
require("dotenv").config();

const connectDB = require("./config/db");

const app = express();

// ─── Connect Database ─────────────────────────────────────────────────────────
connectDB();

// ─── CORS ─────────────────────────────────────────────────────────────────────
app.use(cors({
  origin:         process.env.ALLOWED_ORIGIN || "*",
  credentials:    true,
  methods:        ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
}));

// ─── Core Middleware ──────────────────────────────────────────────────────────
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// ─── EJS View Engine ──────────────────────────────────────────────────────────
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// ─── Session ──────────────────────────────────────────────────────────────────
const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/triplink";

app.use(session({
  secret:            process.env.SESSION_SECRET || "triplink-super-secret-key-2024",
  resave:            false,
  saveUninitialized: false,
  store:             MongoStore.create({ mongoUrl: MONGO_URI }),
  cookie:            { maxAge: 1000 * 60 * 60 * 24 },  // 24 hours
}));

// ─── EJS Routes ───────────────────────────────────────────────────────────────
app.use("/auth",   require("./routes/auth"));
app.use("/rider",  require("./routes/rider"));
app.use("/driver", require("./routes/driver"));
app.use("/ride",   require("./routes/ride"));

// ─── REST API Routes ──────────────────────────────────────────────────────────
app.use("/api/v1/auth",    require("./routes/auth"));
app.use("/api/v1/ride",    require("./routes/ride"));
app.use("/api/v1/driver",  require("./routes/driver"));
app.use("/api/v1/payment", require("./routes/payment"));

// ─── Home Page ────────────────────────────────────────────────────────────────
app.get("/", (req, res) => {
  res.render("home", { user: req.session.user || null });
});

// ─── 404 Handler ──────────────────────────────────────────────────────────────
app.use((req, res) => {
  if (req.path.startsWith("/api/")) {
    return res.status(404).json({ error: "Route not found" });
  }
  res.status(404).render("home", { user: req.session.user || null });
});

// ─── Global Error Handler ─────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  if (req.path.startsWith("/api/")) {
    return res.status(500).json({ error: "Internal server error" });
  }
  res.status(500).send("Something went wrong. Please try again.");
});

module.exports = app;