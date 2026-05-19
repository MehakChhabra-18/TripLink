/**
 * Auth Repository
 * All user/auth-related database operations via Prisma (PostgreSQL)
 */
const prisma = require("../config/prisma");

/**
 * Create a new user with rider/driver profile
 * @param {{ name, email, password, phone, role }} data
 */
const createUser = async (data) => {
  const { name, email, password, phone, role } = data;

  return prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        name,
        email,
        password,
        phone,
        role,
        // Create role-specific profile
        ...(role === "RIDER"
          ? { rider: { create: {} } }
          : { driver: { create: {} } }),
      },
      include: {
        rider:  role === "RIDER",
        driver: role === "DRIVER",
      },
    });
    return user;
  });
};

/**
 * Find user by email (with password for login comparison)
 */
const findUserByEmail = async (email) =>
  prisma.user.findUnique({ where: { email } });

/**
 * Find user by ID (without password)
 */
const findUserById = async (id) =>
  prisma.user.findUnique({
    where:  { id },
    select: {
      id: true, name: true, email: true, phone: true,
      role: true, isVerified: true, profileImage: true,
      isActive: true, createdAt: true,
    },
  });

/**
 * Find user by phone number
 */
const findUserByPhone = async (phone) =>
  prisma.user.findUnique({ where: { phone } });

/**
 * Update user's isVerified status
 */
const markUserVerified = async (userId) =>
  prisma.user.update({ where: { id: userId }, data: { isVerified: true } });

/**
 * Update user's profile image URL
 */
const updateProfileImage = async (userId, imageUrl) =>
  prisma.user.update({ where: { id: userId }, data: { profileImage: imageUrl } });

/**
 * Update user password
 */
const updatePassword = async (userId, hashedPassword) =>
  prisma.user.update({ where: { id: userId }, data: { password: hashedPassword } });

// ─── Refresh Token Operations ──────────────────────────────────────────────────

/**
 * Store a refresh token
 */
const saveRefreshToken = async (userId, token, expiresAt) =>
  prisma.refreshToken.create({ data: { userId, token, expiresAt } });

/**
 * Find and validate a refresh token (not revoked, not expired)
 */
const findValidRefreshToken = async (token) =>
  prisma.refreshToken.findFirst({
    where: {
      token,
      isRevoked:  false,
      expiresAt:  { gt: new Date() },
    },
  });

/**
 * Revoke a specific refresh token (token rotation on use)
 */
const revokeRefreshToken = async (token) =>
  prisma.refreshToken.updateMany({
    where: { token },
    data:  { isRevoked: true },
  });

/**
 * Revoke all refresh tokens for a user (logout all devices)
 */
const revokeAllUserRefreshTokens = async (userId) =>
  prisma.refreshToken.updateMany({
    where: { userId },
    data:  { isRevoked: true },
  });

// ─── OTP Operations ───────────────────────────────────────────────────────────

/**
 * Create OTP record
 */
const createOTP = async ({ userId, code, type, purpose, expiresAt }) =>
  prisma.oTP.create({ data: { userId, code, type, purpose, expiresAt } });

/**
 * Find valid (unused, unexpired) OTP
 */
const findValidOTP = async (userId, purpose) =>
  prisma.oTP.findFirst({
    where: {
      userId,
      purpose,
      isUsed:    false,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: "desc" },
  });

/**
 * Mark OTP as used
 */
const markOTPUsed = async (otpId) =>
  prisma.oTP.update({ where: { id: otpId }, data: { isUsed: true } });

/**
 * Increment OTP attempt count
 */
const incrementOTPAttempts = async (otpId) =>
  prisma.oTP.update({ where: { id: otpId }, data: { attempts: { increment: 1 } } });

/**
 * Delete all unused OTPs for a user+purpose (before creating new one)
 */
const deleteUserOTPs = async (userId, purpose) =>
  prisma.oTP.deleteMany({ where: { userId, purpose, isUsed: false } });

module.exports = {
  createUser,
  findUserByEmail,
  findUserById,
  findUserByPhone,
  markUserVerified,
  updateProfileImage,
  updatePassword,
  saveRefreshToken,
  findValidRefreshToken,
  revokeRefreshToken,
  revokeAllUserRefreshTokens,
  createOTP,
  findValidOTP,
  markOTPUsed,
  incrementOTPAttempts,
  deleteUserOTPs,
};
