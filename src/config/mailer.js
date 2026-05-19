/**
 * Nodemailer Configuration
 * Used for email OTP and notifications
 */
const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  host:   process.env.SMTP_HOST   || "smtp.gmail.com",
  port:   parseInt(process.env.SMTP_PORT || "587"),
  secure: process.env.SMTP_SECURE === "true",
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

/**
 * Verify transporter connection on startup
 */
const verifyMailer = async () => {
  try {
    await transporter.verify();
    console.log("✅ Email transporter ready");
  } catch (err) {
    console.warn("⚠️  Email transporter not configured:", err.message);
  }
};

module.exports = { transporter, verifyMailer };
