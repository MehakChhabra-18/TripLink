/**
 * Razorpay Configuration
 * Gracefully returns null if keys are not configured.
 * Consumers should check: if (!razorpay) throw new Error("Razorpay not configured");
 */

let razorpay = null;

if (process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET) {
  const Razorpay = require("razorpay");
  razorpay = new Razorpay({
    key_id:     process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
  });
} else {
  console.warn("⚠️  Razorpay not configured — payment features disabled.");
}

module.exports = razorpay;
