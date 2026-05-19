const express = require("express");
const router  = express.Router();
const auth    = require("../controllers/authController");

// ─── EJS / SSR Routes ─────────────────────────────────────────────────────────
router.get("/register", (req, res) => res.render("register", { error: null }));
router.get("/login",    (req, res) => res.render("login",    { error: null }));

router.post("/register", auth.register);
router.post("/login",    auth.login);

router.get("/logout", auth.logout);

// ─── REST API Routes (used by React frontend) ─────────────────────────────────
// POST /api/v1/auth/register  →  returns { token, user }
// POST /api/v1/auth/login     →  returns { token, user }
// (Same controller handles both SSR and API via Accept header detection)

module.exports = router;