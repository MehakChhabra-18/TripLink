/**
 * Authentication Zod validation schemas
 */
const { z } = require("zod");

const registerSchema = z.object({
  name:     z.string().min(2).max(100).trim(),
  email:    z.string().email().toLowerCase().trim(),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[0-9]/, "Password must contain at least one number"),
  phone:    z.string().regex(/^[6-9]\d{9}$/, "Invalid Indian phone number").optional(),
  role:     z.enum(["RIDER", "DRIVER"]),

  // Driver-only fields (conditionally required)
  licenseNumber: z.string().optional(),
  carModel:      z.string().optional(),
  carNumber:     z.string().optional(),
});

const loginSchema = z.object({
  email:    z.string().email().toLowerCase().trim(),
  password: z.string().min(1, "Password is required"),
});

const refreshTokenSchema = z.object({
  refreshToken: z.string().optional(), // may come from cookie
});

const verifyOTPSchema = z.object({
  userId:  z.string().uuid(),
  code:    z.string().length(6, "OTP must be 6 digits"),
  purpose: z.enum(["REGISTRATION", "LOGIN", "RIDE_START", "PASSWORD_RESET"]),
});

const resendOTPSchema = z.object({
  userId:  z.string().uuid(),
  purpose: z.enum(["REGISTRATION", "LOGIN", "RIDE_START", "PASSWORD_RESET"]),
});

module.exports = {
  registerSchema,
  loginSchema,
  refreshTokenSchema,
  verifyOTPSchema,
  resendOTPSchema,
};
