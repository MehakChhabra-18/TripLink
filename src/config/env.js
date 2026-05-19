/**
 * Environment variable validation
 * Throws on startup if required vars are missing
 */
const requiredVars = [
  "DATABASE_URL",
  "JWT_SECRET",
  "JWT_REFRESH_SECRET",
  "RAZORPAY_KEY_ID",
  "RAZORPAY_KEY_SECRET",
];

const optionalVars = [
  "MONGO_URI",
  "PORT",
  "CLOUDINARY_CLOUD_NAME",
  "CLOUDINARY_API_KEY",
  "CLOUDINARY_API_SECRET",
  "SMTP_HOST",
  "SMTP_USER",
  "SMTP_PASS",
  "GOOGLE_MAPS_API",
  "FRONTEND_URL",
  "RAZORPAY_WEBHOOK_SECRET",
];

const validateEnv = () => {
  const missing = requiredVars.filter((v) => !process.env[v]);

  if (missing.length > 0) {
    console.error(`❌ Missing required environment variables:\n  ${missing.join("\n  ")}`);
    process.exit(1);
  }

  const missingOptional = optionalVars.filter((v) => !process.env[v]);
  if (missingOptional.length > 0) {
    console.warn(`⚠️  Optional env vars not set:\n  ${missingOptional.join("\n  ")}`);
  }

  console.log("✅ Environment variables validated");
};

module.exports = { validateEnv };
