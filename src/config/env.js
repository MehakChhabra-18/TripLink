/**
 * Environment variable validation
 * Throws on startup if required vars are missing
 *
 * NOTE: During the Firebase migration, DATABASE_URL and RAZORPAY keys
 * are treated as optional-with-warning. JWT_SECRET remains required
 * as it's used by the legacy auth system still in place.
 */
const requiredVars = [
  "JWT_SECRET",
];

const importantVars = [
  "DATABASE_URL",
  "JWT_REFRESH_SECRET",
  "RAZORPAY_KEY_ID",
  "RAZORPAY_KEY_SECRET",
];

const optionalVars = [
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
  "FIREBASE_API_KEY",
  "FIREBASE_AUTH_DOMAIN",
  "FIREBASE_PROJECT_ID",
  "FIREBASE_STORAGE_BUCKET",
  "FIREBASE_MESSAGING_SENDER_ID",
  "FIREBASE_APP_ID",
  "FIREBASE_DATABASE_URL",
];

const validateEnv = () => {
  const missing = requiredVars.filter((v) => !process.env[v]);

  if (missing.length > 0) {
    console.error(`❌ Missing required environment variables:\n  ${missing.join("\n  ")}`);
    process.exit(1);
  }

  const missingImportant = importantVars.filter((v) => !process.env[v]);
  if (missingImportant.length > 0) {
    console.warn(`⚠️  Missing important env vars (legacy services may not work):\n  ${missingImportant.join("\n  ")}`);
  }

  const missingOptional = optionalVars.filter((v) => !process.env[v]);
  if (missingOptional.length > 0) {
    console.warn(`ℹ️  Optional env vars not set:\n  ${missingOptional.join("\n  ")}`);
  }

  console.log("✅ Environment variables validated");
};

module.exports = { validateEnv };
