const jwt  = require("jsonwebtoken");
const User = require("../models/User");

const JWT_SECRET  = process.env.JWT_SECRET  || "triplink-jwt-secret-2024";
const JWT_EXPIRES = process.env.JWT_EXPIRES || "7d";

// ─── Helpers ──────────────────────────────────────────────────────────────────
const isApiRequest = (req) =>
  req.path.startsWith("/api/") ||
  (req.headers.accept && req.headers.accept.includes("application/json")) ||
  req.headers["content-type"] === "application/json";

function signToken(user) {
  return jwt.sign(
    { id: user._id, name: user.name, role: user.role },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES }
  );
}

// ─── REGISTER ─────────────────────────────────────────────────────────────────
exports.register = async (req, res) => {
  try {
    const { name, email, password, role, phone, carModel, carNumber } = req.body;

    if (!name || !email || !password || !role) {
      if (isApiRequest(req)) {
        return res.status(400).json({ error: "Name, email, password and role are required" });
      }
      return res.render("register", { error: "All fields are required" });
    }

    const existing = await User.findOne({ email });
    if (existing) {
      if (isApiRequest(req)) {
        return res.status(409).json({ error: "Email already registered" });
      }
      return res.render("register", { error: "Email already registered" });
    }

    // Password is hashed by the pre-save hook in User model
    const user = await User.create({
      name,
      email,
      password,
      role,
      phone,
      carModel:  role === "driver" ? carModel  : undefined,
      carNumber: role === "driver" ? carNumber : undefined,
    });

    if (isApiRequest(req)) {
      const token = signToken(user);
      return res.status(201).json({
        token,
        user: { id: user._id, name: user.name, role: user.role, email: user.email },
      });
    }

    res.redirect("/auth/login");
  } catch (err) {
    console.error("Register error:", err);
    if (isApiRequest(req)) {
      return res.status(500).json({ error: err.message });
    }
    res.render("register", { error: "Registration failed. Please try again." });
  }
};

// ─── LOGIN ────────────────────────────────────────────────────────────────────
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      if (isApiRequest(req)) return res.status(401).json({ error: "User not found" });
      return res.render("login", { error: "User not found" });
    }

    const match = await user.comparePassword(password);
    if (!match) {
      if (isApiRequest(req)) return res.status(401).json({ error: "Incorrect password" });
      return res.render("login", { error: "Wrong password" });
    }

    // Set session (for EJS)
    req.session.user = {
      id:          user._id,
      name:        user.name,
      role:        user.role,
      isAvailable: user.isAvailable,
      carModel:    user.carModel,
    };

    if (isApiRequest(req)) {
      const token = signToken(user);
      return res.json({
        token,
        user: { id: user._id, name: user.name, role: user.role, email: user.email },
      });
    }

    if (user.role === "rider")  return res.redirect("/rider/dashboard");
    if (user.role === "driver") return res.redirect("/driver/dashboard");
    res.redirect("/");
  } catch (err) {
    console.error("Login error:", err);
    if (isApiRequest(req)) return res.status(500).json({ error: err.message });
    res.render("login", { error: "Login failed. Please try again." });
  }
};

// ─── LOGOUT ───────────────────────────────────────────────────────────────────
exports.logout = (req, res) => {
  req.session.destroy(() => {
    if (isApiRequest(req)) return res.json({ message: "Logged out" });
    res.redirect("/");
  });
};

// ─── GET CURRENT USER (API only) ─────────────────────────────────────────────
exports.getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-password");
    res.json({ user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};