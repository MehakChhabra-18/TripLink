/**
 * JWT utility functions
 * Access tokens: short-lived (15 min)
 * Refresh tokens: long-lived (7 days)
 */
const jwt = require("jsonwebtoken");

const ACCESS_SECRET  = process.env.JWT_SECRET;
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;

const ACCESS_EXPIRES  = process.env.JWT_ACCESS_EXPIRES  || "15m";
const REFRESH_EXPIRES = process.env.JWT_REFRESH_EXPIRES || "7d";

/**
 * Generate JWT access token
 * @param {{ id: string, role: string }} payload
 */
const generateAccessToken = (payload) =>
  jwt.sign(payload, ACCESS_SECRET, { expiresIn: ACCESS_EXPIRES });

/**
 * Generate JWT refresh token
 * @param {{ id: string }} payload
 */
const generateRefreshToken = (payload) =>
  jwt.sign(payload, REFRESH_SECRET, { expiresIn: REFRESH_EXPIRES });

/**
 * Verify access token
 * @param {string} token
 * @returns {object} decoded payload
 */
const verifyAccessToken = (token) => jwt.verify(token, ACCESS_SECRET);

/**
 * Verify refresh token
 * @param {string} token
 * @returns {object} decoded payload
 */
const verifyRefreshToken = (token) => jwt.verify(token, REFRESH_SECRET);

/**
 * Get token expiry in milliseconds from env string (e.g. "7d" → 604800000)
 */
const getRefreshTokenExpiryMs = () => {
  const val = REFRESH_EXPIRES;
  if (val.endsWith("d")) return parseInt(val) * 24 * 60 * 60 * 1000;
  if (val.endsWith("h")) return parseInt(val) * 60 * 60 * 1000;
  if (val.endsWith("m")) return parseInt(val) * 60 * 1000;
  return 7 * 24 * 60 * 60 * 1000; // default 7d
};

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  getRefreshTokenExpiryMs,
};
