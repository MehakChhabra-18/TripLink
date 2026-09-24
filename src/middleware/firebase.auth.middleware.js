/**
 * Firebase Authentication Middleware
 * ─────────────────────────────────────────────────────────────────────────────
 * Verifies Firebase ID tokens passed in the Authorization header.
 * Falls back gracefully to the existing JWT/session middleware during migration.
 *
 * Priority order:
 *   1. Firebase ID token  (Authorization: Bearer <firebase-id-token>)
 *   2. Legacy JWT         (Authorization: Bearer <jwt>)  — backwards compat
 *   3. Session            (req.session.user)             — EJS routes
 */
const { verifyIdToken } = require("../config/firebase");
const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET || "triplink-jwt-secret-2024";

/**
 * Detect whether a token looks like a Firebase ID token (long JWT with 3 parts,
 * issued by Google OAuth2 / Firebase) vs a short app-generated JWT.
 * Firebase tokens are always signed by Google and contain "firebase" in the header.
 * We use a heuristic: Firebase tokens are typically > 500 chars.
 */
function looksLikeFirebaseToken(token) {
  if (!token) return false;
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  try {
    const header = JSON.parse(Buffer.from(parts[0], "base64").toString());
    // Firebase tokens have alg RS256 signed by Google
    return header.alg === "RS256";
  } catch {
    return false;
  }
}

/**
 * authenticateFirebase
 * ─────────────────────────────────────────────────────────────────────────────
 * Middleware that verifies Firebase ID tokens.
 * Sets req.user = { uid, email, role, name } on success.
 *
 * If Firebase Admin SDK is not yet configured (during migration), falls back
 * to legacy JWT verification automatically.
 */
const authenticateFirebase = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

    // ── 1. Firebase ID Token ──────────────────────────────────────────────────
    if (token && looksLikeFirebaseToken(token)) {
      try {
        const decoded = await verifyIdToken(token);
        req.user = {
          uid:   decoded.uid,
          id:    decoded.uid,       // compat alias for legacy code
          email: decoded.email,
          name:  decoded.name,
          role:  decoded.role || decoded.claims?.role || "RIDER",
          firebaseUser: decoded,
        };
        req.authMethod = "firebase";
        return next();
      } catch (fbErr) {
        // Firebase token verification failed — fall through to legacy JWT
        console.warn("Firebase token verification failed:", fbErr.message);
      }
    }

    // ── 2. Legacy JWT ─────────────────────────────────────────────────────────
    if (token && !looksLikeFirebaseToken(token)) {
      try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = {
          uid:  decoded.id,
          id:   decoded.id,
          name: decoded.name,
          role: decoded.role,
          authMethod: "jwt",
        };
        req.authMethod = "jwt";
        return next();
      } catch {
        // JWT invalid — fall through to session
      }
    }

    // ── 3. Express Session (EJS pages) ────────────────────────────────────────
    if (req.session?.user) {
      req.user = {
        uid:  req.session.user.id,
        id:   req.session.user.id,
        name: req.session.user.name,
        role: req.session.user.role,
        authMethod: "session",
      };
      req.authMethod = "session";
      return next();
    }

    return res.status(401).json({ success: false, message: "Authentication required" });

  } catch (err) {
    console.error("Auth middleware error:", err);
    return res.status(500).json({ success: false, message: "Authentication error" });
  }
};

/**
 * requireRole
 * Middleware factory for role-based access control.
 * Uses custom claim (from Firebase token) or legacy role field.
 *
 * Example: router.use(requireRole("ADMIN"))
 *
 * @param {...string} roles  Allowed role(s)
 */
const requireRole = (...roles) => (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ success: false, message: "Not authenticated" });
  }

  const userRole = req.user.role?.toUpperCase();
  const allowed  = roles.map((r) => r.toUpperCase());

  if (!allowed.includes(userRole)) {
    return res.status(403).json({
      success: false,
      message: `Access denied. Required: ${allowed.join(" or ")}`,
    });
  }

  next();
};

/**
 * optionalAuth
 * Non-blocking auth — populates req.user if a valid token exists,
 * but does not reject unauthenticated requests.
 * Used for pages visible to both guests and logged-in users (e.g., landing page).
 */
const optionalAuth = async (req, res, next) => {
  try {
    await new Promise((resolve) => {
      authenticateFirebase(req, res, resolve);
    });
  } catch {
    // ignore errors — user stays undefined
  }
  next();
};

module.exports = { authenticateFirebase, requireRole, optionalAuth };
