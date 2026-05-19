/**
 * OTP generation and email delivery utilities
 */
const crypto = require("crypto");
const { transporter } = require("../config/mailer");

/**
 * Generate a numeric OTP of given length
 * @param {number} length - OTP length (default 6)
 * @returns {string}
 */
const generateOTP = (length = 6) => {
  const min = Math.pow(10, length - 1);
  const max = Math.pow(10, length) - 1;
  return String(crypto.randomInt(min, max + 1));
};

/**
 * Get OTP expiry date (default 10 minutes)
 * @param {number} minutes
 */
const getOTPExpiry = (minutes = 10) => {
  const date = new Date();
  date.setMinutes(date.getMinutes() + minutes);
  return date;
};

/**
 * Send OTP via email
 * @param {string} to       - Recipient email
 * @param {string} otp      - OTP code
 * @param {string} purpose  - "LOGIN" | "REGISTRATION" | "RIDE_START" | "PASSWORD_RESET"
 */
const sendOTPEmail = async (to, otp, purpose = "LOGIN") => {
  const subjects = {
    LOGIN:          "Your TripLink Login OTP",
    REGISTRATION:   "Verify your TripLink account",
    RIDE_START:     "Your ride start OTP",
    PASSWORD_RESET: "Reset your TripLink password",
  };

  const subject = subjects[purpose] || "Your TripLink OTP";

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px; background: #f9f9f9; border-radius: 12px;">
      <h2 style="color: #1a1a2e; text-align: center; margin-bottom: 8px;">🚗 TripLink</h2>
      <h3 style="text-align: center; color: #444;">${subject}</h3>
      <div style="background: #fff; border-radius: 8px; padding: 24px; text-align: center; margin: 24px 0; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">
        <p style="font-size: 14px; color: #666; margin-bottom: 12px;">Your one-time password is:</p>
        <h1 style="font-size: 42px; letter-spacing: 12px; color: #6c63ff; margin: 0;">${otp}</h1>
      </div>
      <p style="font-size: 12px; color: #999; text-align: center;">This OTP expires in 10 minutes. Do not share it with anyone.</p>
    </div>
  `;

  await transporter.sendMail({
    from:    `"TripLink" <${process.env.SMTP_USER}>`,
    to,
    subject,
    html,
  });
};

/**
 * Hash an OTP before storing (for security)
 * @param {string} otp
 * @returns {string} SHA-256 hex hash
 */
const hashOTP = (otp) => crypto.createHash("sha256").update(otp).digest("hex");

module.exports = { generateOTP, getOTPExpiry, sendOTPEmail, hashOTP };
