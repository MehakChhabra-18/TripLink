/**
 * TripLink Firebase Client Configuration
 * ─────────────────────────────────────────────────────────────────────────────
 * This file initializes the Firebase Web SDK (client-side) for use in:
 *   - EJS frontend pages (included via <script> or bundled)
 *   - Future React/Next.js frontend
 *
 * Firebase Web SDK is SAFE to include in browser code.
 * It uses the PUBLIC Firebase config (NOT the service account private key).
 *
 * USAGE:
 *   In EJS templates, reference /js/firebase-client.js (served as static file)
 *   Or import directly if using a bundler.
 *
 * Environment variables injected by Express at build/serve time.
 * The client config contains only PUBLIC Firebase project identifiers.
 */

/**
 * Get Firebase client config from environment variables.
 * All FIREBASE_* vars below are PUBLIC and safe to expose to the browser.
 * They are project identifiers, NOT secrets.
 *
 * @returns {object} Firebase client config object
 */
function getFirebaseClientConfig() {
  return {
    apiKey:            process.env.FIREBASE_API_KEY,
    authDomain:        process.env.FIREBASE_AUTH_DOMAIN,
    projectId:         process.env.FIREBASE_PROJECT_ID,
    storageBucket:     process.env.FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
    appId:             process.env.FIREBASE_APP_ID,
    measurementId:     process.env.FIREBASE_MEASUREMENT_ID,
    databaseURL:       process.env.FIREBASE_DATABASE_URL,
  };
}

module.exports = { getFirebaseClientConfig };
