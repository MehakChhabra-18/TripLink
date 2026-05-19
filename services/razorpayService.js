const Razorpay = require("razorpay");
const crypto   = require("crypto");

// ⚠️  Replace with your real Razorpay test keys from https://dashboard.razorpay.com/
// Sign up free → Settings → API Keys → Generate Test Key
const razorpay = new Razorpay({
  key_id:     process.env.RAZORPAY_KEY_ID     || "rzp_test_REPLACE_WITH_YOUR_KEY_ID",
  key_secret: process.env.RAZORPAY_KEY_SECRET || "REPLACE_WITH_YOUR_KEY_SECRET",
});

/**
 * Create a Razorpay order
 * @param {number} amountInRupees
 * @returns {Promise<Object>} Razorpay order object
 */
async function createOrder(amountInRupees) {
  const options = {
    amount:   Math.round(amountInRupees * 100), // Razorpay expects paise
    currency: "INR",
    receipt:  `receipt_${Date.now()}`,
  };
  return razorpay.orders.create(options);
}

/**
 * Verify Razorpay payment signature
 * @param {string} orderId
 * @param {string} paymentId
 * @param {string} signature
 * @returns {boolean}
 */
function verifySignature(orderId, paymentId, signature) {
  const body      = `${orderId}|${paymentId}`;
  const secret    = process.env.RAZORPAY_KEY_SECRET || "REPLACE_WITH_YOUR_KEY_SECRET";
  const expected  = crypto.createHmac("sha256", secret).update(body).digest("hex");
  return expected === signature;
}

module.exports = { razorpay, createOrder, verifySignature };
