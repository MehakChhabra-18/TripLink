/**
 * Auth Controller
 * Handles req/res — delegates all business logic to auth.service
 */
const authService = require("../services/auth.service");
const asyncHandler = require("../utils/asyncHandler");
const { sendSuccess } = require("../utils/response");
const { COOKIE_NAMES } = require("../constants");

const REFRESH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure:   process.env.NODE_ENV === "production",
  sameSite: process.env.NODE_ENV === "production" ? "strict" : "lax",
  maxAge:   7 * 24 * 60 * 60 * 1000, // 7 days
};

// ─── POST /api/v1/auth/register ───────────────────────────────────────────────
const register = asyncHandler(async (req, res) => {
  const result = await authService.register(req.body);

  // Set refresh token in HttpOnly cookie
  res.cookie(COOKIE_NAMES.REFRESH_TOKEN, result.refreshToken, REFRESH_COOKIE_OPTIONS);

  sendSuccess(res, 201, "Registration successful", {
    user:                 result.user,
    accessToken:          result.accessToken,
    requiresVerification: result.requiresVerification,
  });
});

// ─── POST /api/v1/auth/login ──────────────────────────────────────────────────
const login = asyncHandler(async (req, res) => {
  const result = await authService.login(req.body);

  res.cookie(COOKIE_NAMES.REFRESH_TOKEN, result.refreshToken, REFRESH_COOKIE_OPTIONS);

  sendSuccess(res, 200, "Login successful", {
    user:        result.user,
    accessToken: result.accessToken,
  });
});

// ─── POST /api/v1/auth/refresh ────────────────────────────────────────────────
const refreshToken = asyncHandler(async (req, res) => {
  // Check cookie first, then body
  const token = req.cookies?.[COOKIE_NAMES.REFRESH_TOKEN] || req.body.refreshToken;

  const result = await authService.refreshTokens(token);

  res.cookie(COOKIE_NAMES.REFRESH_TOKEN, result.refreshToken, REFRESH_COOKIE_OPTIONS);

  sendSuccess(res, 200, "Token refreshed", { accessToken: result.accessToken });
});

// ─── POST /api/v1/auth/logout ─────────────────────────────────────────────────
const logout = asyncHandler(async (req, res) => {
  await authService.logout(req.user.id);

  res.clearCookie(COOKIE_NAMES.REFRESH_TOKEN);
  sendSuccess(res, 200, "Logged out successfully");
});

// ─── POST /api/v1/auth/verify-otp ────────────────────────────────────────────
const verifyOTP = asyncHandler(async (req, res) => {
  const result = await authService.verifyOTP(req.body);
  sendSuccess(res, 200, "OTP verified successfully", result);
});

// ─── POST /api/v1/auth/resend-otp ────────────────────────────────────────────
const resendOTP = asyncHandler(async (req, res) => {
  const result = await authService.resendOTP(req.body);
  sendSuccess(res, 200, result.message);
});

// ─── GET /api/v1/auth/me ──────────────────────────────────────────────────────
const getMe = asyncHandler(async (req, res) => {
  const user = await authService.getProfile(req.user.id);
  sendSuccess(res, 200, "Profile fetched", user);
});

module.exports = { register, login, refreshToken, logout, verifyOTP, resendOTP, getMe };
