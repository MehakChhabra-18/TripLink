/**
 * Ride-related Zod validation schemas
 */
const { z } = require("zod");

const bookRideSchema = z.object({
  pickupAddress:      z.string().min(3).max(500).trim(),
  pickupLat:          z.number().min(-90).max(90).optional(),
  pickupLng:          z.number().min(-180).max(180).optional(),
  destinationAddress: z.string().min(3).max(500).trim(),
  destinationLat:     z.number().min(-90).max(90).optional(),
  destinationLng:     z.number().min(-180).max(180).optional(),
  offeredFare:        z.number().min(1, "Offered fare must be at least ₹1"),
});

const updateRideStatusSchema = z.object({
  status: z.enum(["ACCEPTED", "STARTED", "COMPLETED", "CANCELLED", "REJECTED"]),
});

const verifyRideOTPSchema = z.object({
  rideId: z.string().uuid(),
  otp:    z.string().length(4, "Ride OTP must be 4 digits"),
});

const getRideHistorySchema = z.object({
  page:   z.coerce.number().min(1).default(1),
  limit:  z.coerce.number().min(1).max(50).default(10),
  status: z.enum(["PENDING","ACCEPTED","STARTED","COMPLETED","CANCELLED","REJECTED"]).optional(),
});

module.exports = {
  bookRideSchema,
  updateRideStatusSchema,
  verifyRideOTPSchema,
  getRideHistorySchema,
};
