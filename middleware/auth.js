const jwt  = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET || "triplink-jwt-secret-2024";

// ─── SESSION AUTH (for EJS routes) ───────────────────────────────────────────
const sessionAuth = (req, res, next) => {
  if (!req.session.user) {
    return res.redirect("/auth/login");
  }
  next();
};

// ─── JWT AUTH (for React API routes) ─────────────────────────────────────────
const jwtAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "No token provided" });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded; // { id, name, role }
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
};

// ─── DUAL AUTH (works for both session and JWT) ───────────────────────────────
// Tries JWT first, falls back to session
const dualAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.split(" ")[1];
    try {
      req.user = jwt.verify(token, JWT_SECRET);
      return next();
    } catch {
      // fall through to session check
    }
  }

  if (req.session?.user) {
    req.user = {
      id:   req.session.user.id,
      name: req.session.user.name,
      role: req.session.user.role,
    };
    return next();
  }

  if (req.headers.accept?.includes("application/json") || req.path.startsWith("/api/")) {
    return res.status(401).json({ error: "Authentication required" });
  }
  res.redirect("/auth/login");
};

// ─── ROLE GUARD ───────────────────────────────────────────────────────────────
// NOTE: If testing with two roles, use different browsers (Chrome vs Edge/Firefox)
// because tabs in the same browser share session cookies.
const requireRole = (...roles) => (req, res, next) => {
  const role = req.user?.role || req.session?.user?.role;

  if (!roles.includes(role)) {
    if (req.headers.accept?.includes("application/json")) {
      return res.status(403).json({ error: "Access denied — wrong role" });
    }
    // Friendly redirect instead of raw "Access denied"
    const redirectTo = role === "driver" ? "/driver/dashboard" : role === "rider" ? "/rider/dashboard" : "/auth/login";
    return res.redirect(redirectTo);
  }
  next();
};

module.exports = { sessionAuth, jwtAuth, dualAuth, requireRole };