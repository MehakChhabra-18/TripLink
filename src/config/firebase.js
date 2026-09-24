/**
 * Firebase Admin SDK Configuration
 * Used for server-side trusted operations:
 *   - Custom Claims (role enforcement)
 *   - Firestore admin writes
 *   - FCM notifications
 *   - Storage signed URLs
 *   - Auth token verification in middleware
 *
 * NEVER expose this config to the frontend.
 * The Firebase Admin SDK uses a service account private key.
 */
const admin = require("firebase-admin");

let _app = null;

/**
 * Initialize Firebase Admin SDK (singleton)
 * Reads service account from FIREBASE_SERVICE_ACCOUNT env var (JSON string)
 * or from a local service-account.json file in development.
 */
function getFirebaseAdmin() {
  if (_app) return _app;

  if (admin && Array.isArray(admin.apps) && admin.apps.length > 0) {
    _app = admin.app();
    return _app;
  }

  try {
    // Production: service account JSON stored as an env var (base64 encoded)
    if (process.env.FIREBASE_SERVICE_ACCOUNT_BASE64) {
      const serviceAccount = JSON.parse(
        Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_BASE64, "base64").toString("utf8")
      );
      _app = admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        databaseURL: process.env.FIREBASE_DATABASE_URL,
        storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
      });
      console.log("✅ Firebase Admin SDK initialized (service account from env)");
      return _app;
    }

    // Development with Emulator or Demo project fallback
    const projectId = process.env.FIREBASE_PROJECT_ID || "triplink-dev";
    _app = admin.initializeApp({
      projectId,
      databaseURL: process.env.FIREBASE_DATABASE_URL,
      storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
    });
    console.log(`✅ Firebase Admin SDK initialized (project: ${projectId})`);
    return _app;

  } catch (err) {
    console.warn("⚠️  Firebase Admin SDK not initialized:", err.message);
    return null;
  }
}

// ─── Exported admin service accessors ────────────────────────────────────────
// These return null gracefully if Firebase Admin is not yet configured,
// so the existing Prisma/Express stack continues to function during migration.

const getFirestore = () => {
  const app = getFirebaseAdmin();
  return app ? admin.firestore(app) : null;
};

const getAuth = () => {
  const app = getFirebaseAdmin();
  return app ? admin.auth(app) : null;
};

const getStorage = () => {
  const app = getFirebaseAdmin();
  return app ? admin.storage(app) : null;
};

const getDatabase = () => {
  const app = getFirebaseAdmin();
  return app ? admin.database(app) : null;
};

const getMessaging = () => {
  const app = getFirebaseAdmin();
  return app ? admin.messaging(app) : null;
};

// ─── Custom Claims Helpers ────────────────────────────────────────────────────

/**
 * Set custom claim on a Firebase user for role enforcement.
 * Roles: RIDER | DRIVER | ADMIN
 *
 * @param {string} uid   Firebase UID
 * @param {string} role  One of 'RIDER', 'DRIVER', 'ADMIN'
 */
async function setUserRole(uid, role) {
  const auth = getAuth();
  if (!auth) throw new Error("Firebase Auth not initialized");
  await auth.setCustomUserClaims(uid, { role });
  console.log(`✅ Custom claim set: uid=${uid}, role=${role}`);
}

/**
 * Verify a Firebase ID token and extract claims.
 * Returns the decoded token or throws.
 *
 * @param {string} idToken  Token from client Authorization header
 * @returns {object}        Decoded token with uid, role, email
 */
async function verifyIdToken(idToken) {
  const auth = getAuth();
  if (!auth) throw new Error("Firebase Auth not initialized");
  return auth.verifyIdToken(idToken);
}

module.exports = {
  getFirebaseAdmin,
  getFirestore,
  getAuth,
  getStorage,
  getDatabase,
  getMessaging,
  setUserRole,
  verifyIdToken,
  admin,
};
