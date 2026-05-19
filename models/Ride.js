const mongoose = require("mongoose");

const rideSchema = new mongoose.Schema(
  {
    rider:  { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    driver: { type: mongoose.Schema.Types.ObjectId, ref: "User" },

    pickup:      { type: String, required: true },
    destination: { type: String, required: true },   // renamed from "drop" for clarity
    // Keep "drop" as a virtual alias for backward-compat with EJS views
    distanceKm:    { type: Number, default: 0 },
    estimatedFare: { type: Number, default: 0 },
    offeredFare:   { type: Number, default: 0 },   // Rider-proposed (InDrive bidding)

    // Status tracking
    rideStatus: {
      type: String,
      enum: ["pending", "accepted", "started", "completed", "cancelled", "rejected"],
      default: "pending",
    },

    // Payment
    paymentStatus: {
      type: String,
      enum: ["pending", "paid", "failed"],
      default: "pending",
    },
    razorpayOrderId:   { type: String },
    razorpayPaymentId: { type: String },

    // Ride-start OTP (4-digit)
    rideOTP:     { type: String },
    otpVerified: { type: Boolean, default: false },

    // Timestamps for ride lifecycle
    acceptedAt:  { type: Date },
    startedAt:   { type: Date },
    completedAt: { type: Date },
  },
  { timestamps: true }
);

// Virtual alias "drop" → "destination" so old EJS templates still work
rideSchema.virtual("drop").get(function () {
  return this.destination;
});

rideSchema.set("toJSON",   { virtuals: true });
rideSchema.set("toObject", { virtuals: true });

module.exports = mongoose.model("Ride", rideSchema);