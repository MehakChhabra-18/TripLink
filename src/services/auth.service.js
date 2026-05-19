/**
 * Auth Service
 * Contains all authentication business logic
 */
const bcrypt = require("bcrypt");
const authRepo = require("../repositories/auth.repository");
const AppError = require("../utils/AppError");
const {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
  getRefreshTokenExpiryMs,
} = require("../utils/jwt");
const { generateOTP, getOTPExpiry, sendOTPEmail, hashOTP } = require("../utils/otp");
const { OTP_CONFIG, OTP_PURPOSE } = require("../constants");

const SALT_ROUNDS = 12;

/**
 * Register a new user
 * - Hash password
 * - Create user + role profile
 * - Generate OTP for email verification
 * - Return tokens (user is auto-logged in after registration)
 */
const register = async ({ name, email, password, phone, role }) => {
  // Check duplicate email
  const existing = await authRepo.findUserByEmail(email);
  if (existing) {
    throw AppError.conflict("Email already registered", "EMAIL_TAKEN");
  }

  // Check duplicate phone if provided
  if (phone) {
    const phoneExists = await authRepo.findUserByPhone(phone);
    if (phoneExists) {
      throw AppError.conflict("Phone number already registered", "PHONE_TAKEN");
    }
  }

  const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
  const roleEnum = role.toUpperCase(); // normalize "rider" → "RIDER"

  const user = await authRepo.createUser({
    name, email, password: hashedPassword, phone, role: roleEnum,
  });

  // Send email OTP for verification
  const otp       = generateOTP(OTP_CONFIG.LENGTH);
  const expiresAt = getOTPExpiry(OTP_CONFIG.EXPIRY_MIN);

  await authRepo.deleteUserOTPs(user.id, OTP_PURPOSE.REGISTRATION);
  await authRepo.createOTP({
    userId:    user.id,
    code:      hashOTP(otp), // Store hash not plaintext
    type:      "EMAIL",
    purpose:   OTP_PURPOSE.REGISTRATION,
    expiresAt,
  });

  // Send OTP email (non-blocking, don't fail registration if email fails)
  sendOTPEmail(email, otp, "REGISTRATION").catch((err) =>
    console.warn("OTP email failed:", err.message)
  );

  // Generate tokens
  const accessToken  = generateAccessToken({ id: user.id, role: user.role });
  const refreshToken = generateRefreshToken({ id: user.id });
  const expiresIn    = getRefreshTokenExpiryMs();

  await authRepo.saveRefreshToken(user.id, refreshToken, new Date(Date.now() + expiresIn));

  return {
    user: { id: user.id, name: user.name, email: user.email, role: user.role },
    accessToken,
    refreshToken,
    requiresVerification: true,
  };
};

/**
 * Login with email + password
 * - Validates credentials
 * - Rotates refresh token on login
 */
const login = async ({ email, password }) => {
  const user = await authRepo.findUserByEmail(email);
  if (!user) {
    throw AppError.unauthorized("Invalid email or password");
  }

  if (!user.isActive) {
    throw AppError.forbidden("Your account has been deactivated");
  }

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) {
    throw AppError.unauthorized("Invalid email or password");
  }

  const accessToken  = generateAccessToken({ id: user.id, role: user.role });
  const refreshToken = generateRefreshToken({ id: user.id });
  const expiresIn    = getRefreshTokenExpiryMs();

  await authRepo.saveRefreshToken(user.id, refreshToken, new Date(Date.now() + expiresIn));

  return {
    user: { id: user.id, name: user.name, email: user.email, role: user.role, isVerified: user.isVerified },
    accessToken,
    refreshToken,
  };
};

/**
 * Refresh access token using refresh token
 * Implements token rotation: old refresh token is revoked and a new one issued
 */
const refreshTokens = async (token) => {
  if (!token) {
    throw AppError.unauthorized("Refresh token required");
  }

  // Verify JWT signature
  let decoded;
  try {
    decoded = verifyRefreshToken(token);
  } catch {
    throw AppError.unauthorized("Invalid or expired refresh token");
  }

  // Check DB record
  const storedToken = await authRepo.findValidRefreshToken(token);
  if (!storedToken) {
    // Possible token reuse attack — revoke all tokens for user
    await authRepo.revokeAllUserRefreshTokens(decoded.id);
    throw AppError.unauthorized("Refresh token has been revoked or reused");
  }

  // Revoke old token (rotation)
  await authRepo.revokeRefreshToken(token);

  // Issue new tokens
  const newAccessToken  = generateAccessToken({ id: decoded.id, role: decoded.role });
  const newRefreshToken = generateRefreshToken({ id: decoded.id });
  const expiresIn       = getRefreshTokenExpiryMs();

  await authRepo.saveRefreshToken(decoded.id, newRefreshToken, new Date(Date.now() + expiresIn));

  return { accessToken: newAccessToken, refreshToken: newRefreshToken };
};

/**
 * Logout — revoke all refresh tokens for user
 */
const logout = async (userId) => {
  await authRepo.revokeAllUserRefreshTokens(userId);
};

/**
 * Verify OTP (registration, login, password reset)
 */
const verifyOTP = async ({ userId, code, purpose }) => {
  const otpRecord = await authRepo.findValidOTP(userId, purpose);

  if (!otpRecord) {
    throw AppError.badRequest("OTP not found or expired", "OTP_EXPIRED");
  }

  if (otpRecord.attempts >= OTP_CONFIG.MAX_ATTEMPTS) {
    throw AppError.badRequest("Too many OTP attempts. Please request a new OTP.", "OTP_MAX_ATTEMPTS");
  }

  const hashedInput = hashOTP(code);
  if (otpRecord.code !== hashedInput) {
    await authRepo.incrementOTPAttempts(otpRecord.id);
    throw AppError.badRequest("Invalid OTP", "OTP_INVALID");
  }

  // Mark OTP as used
  await authRepo.markOTPUsed(otpRecord.id);

  // If registration OTP, verify user
  if (purpose === OTP_PURPOSE.REGISTRATION) {
    await authRepo.markUserVerified(userId);
  }

  return { verified: true };
};

/**
 * Resend OTP
 */
const resendOTP = async ({ userId, purpose }) => {
  const user = await authRepo.findUserById(userId);
  if (!user) throw AppError.notFound("User not found");

  // Check for recent OTP (rate limiting)
  const existing = await authRepo.findValidOTP(userId, purpose);
  if (existing) {
    const ageSeconds = (Date.now() - existing.createdAt.getTime()) / 1000;
    if (ageSeconds < OTP_CONFIG.RESEND_DELAY) {
      const waitSeconds = Math.ceil(OTP_CONFIG.RESEND_DELAY - ageSeconds);
      throw AppError.badRequest(
        `Please wait ${waitSeconds}s before requesting another OTP`,
        "OTP_RESEND_TOO_SOON"
      );
    }
  }

  await authRepo.deleteUserOTPs(userId, purpose);

  const otp       = generateOTP(OTP_CONFIG.LENGTH);
  const expiresAt = getOTPExpiry(OTP_CONFIG.EXPIRY_MIN);

  await authRepo.createOTP({
    userId,
    code:     hashOTP(otp),
    type:     "EMAIL",
    purpose,
    expiresAt,
  });

  // Look up full user for email
  const fullUser = await authRepo.findUserByEmail(user.email);
  sendOTPEmail(fullUser.email, otp, purpose).catch(console.warn);

  return { message: "OTP sent successfully" };
};

/**
 * Get current user's profile
 */
const getProfile = async (userId) => {
  const user = await authRepo.findUserById(userId);
  if (!user) throw AppError.notFound("User not found");
  return user;
};

module.exports = { register, login, refreshTokens, logout, verifyOTP, resendOTP, getProfile };
