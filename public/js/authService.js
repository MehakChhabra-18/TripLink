/**
 * TripLink Auth Service (Firebase)
 * ─────────────────────────────────────────────────────────────────────────────
 * Client-side authentication service that wraps Firebase Auth SDK.
 * Provides:
 *   - Email/Password registration & login
 *   - Google OAuth login
 *   - Phone authentication (OTP)
 *   - Session persistence
 *   - Token refresh
 *   - Firestore user profile sync
 *
 * USAGE (in EJS frontend scripts or bundled JS):
 *   const authService = window.TripLinkAuth;
 *   await authService.loginWithEmail(email, password);
 */

const TripLinkAuth = (() => {
  "use strict";

  // ── Internal state ──────────────────────────────────────────────────────────
  let _auth     = null;  // firebase.auth() instance
  let _db       = null;  // firebase.firestore() instance
  let _user     = null;  // current Firebase User
  let _userDoc  = null;  // Firestore user document
  let _listeners = [];   // auth state change listeners

  // ── Initialize ──────────────────────────────────────────────────────────────

  /**
   * Initialize the auth service.
   * Must be called after Firebase is initialized on the page.
   */
  function init(firebaseApp) {
    if (!firebaseApp) {
      console.warn("TripLinkAuth: Firebase app not provided");
      return;
    }
    _auth = firebaseApp.auth();
    _db   = firebaseApp.firestore();

    // Listen for auth state changes
    _auth.onAuthStateChanged(async (user) => {
      _user = user;
      if (user) {
        _userDoc = await _syncUserDoc(user);
      } else {
        _userDoc = null;
      }
      // Notify all registered listeners
      _listeners.forEach((cb) => cb(_user, _userDoc));
    });
  }

  // ── User Document Sync ───────────────────────────────────────────────────────

  /**
   * Sync Firebase Auth user to Firestore users/{uid}.
   * Creates document on first login.
   * Merges on subsequent logins to avoid overwriting.
   */
  async function _syncUserDoc(user) {
    if (!_db) return null;
    const ref = _db.collection("users").doc(user.uid);

    const snap = await ref.get();
    if (!snap.exists) {
      // First-time user — create profile
      const data = {
        uid:          user.uid,
        name:         user.displayName || "",
        email:        user.email || "",
        phone:        user.phoneNumber || "",
        profileImage: user.photoURL || "",
        role:         "RIDER",  // default role — DRIVER/ADMIN set via Cloud Function
        status:       "ACTIVE",
        createdAt:    firebase.firestore.FieldValue.serverTimestamp(),
        updatedAt:    firebase.firestore.FieldValue.serverTimestamp(),
      };
      await ref.set(data);
      return data;
    }

    // Existing user — update last seen & merge any new profile data
    const updates = {
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    };
    if (user.displayName && !snap.data().name) updates.name = user.displayName;
    if (user.photoURL && !snap.data().profileImage) updates.profileImage = user.photoURL;

    await ref.update(updates);
    return { ...snap.data(), ...updates };
  }

  // ── Email / Password ─────────────────────────────────────────────────────────

  /**
   * Register a new user with email/password.
   *
   * @param {string} email
   * @param {string} password
   * @param {object} profile  { name, phone, role: 'RIDER'|'DRIVER' }
   * @returns {object}        { user, userDoc }
   */
  async function registerWithEmail(email, password, profile = {}) {
    if (!_auth) throw new Error("Auth not initialized");

    const cred = await _auth.createUserWithEmailAndPassword(email, password);
    const user = cred.user;

    // Update display name
    if (profile.name) {
      await user.updateProfile({ displayName: profile.name });
    }

    // Create Firestore profile
    const userRef = _db.collection("users").doc(user.uid);
    const data = {
      uid:          user.uid,
      name:         profile.name || "",
      email:        email,
      phone:        profile.phone || "",
      profileImage: "",
      role:         profile.role || "RIDER",
      status:       "ACTIVE",
      createdAt:    firebase.firestore.FieldValue.serverTimestamp(),
      updatedAt:    firebase.firestore.FieldValue.serverTimestamp(),
    };
    await userRef.set(data);
    _userDoc = data;

    // If registering as DRIVER — create driver profile too
    if (profile.role === "DRIVER") {
      await _db.collection("drivers").doc(user.uid).set({
        userId:               user.uid,
        verificationStatus:   "PENDING",
        availabilityStatus:   "OFFLINE",
        rating:               5.0,
        totalTrips:           0,
        totalEarnings:        0,
        vehicleId:            null,
        createdAt:            firebase.firestore.FieldValue.serverTimestamp(),
        updatedAt:            firebase.firestore.FieldValue.serverTimestamp(),
      });
    }

    return { user, userDoc: data };
  }

  /**
   * Login with email/password.
   *
   * @param {string} email
   * @param {string} password
   * @returns {object}  { user, userDoc }
   */
  async function loginWithEmail(email, password) {
    if (!_auth) throw new Error("Auth not initialized");
    const cred = await _auth.signInWithEmailAndPassword(email, password);
    const userDoc = await _syncUserDoc(cred.user);
    return { user: cred.user, userDoc };
  }

  // ── Google OAuth ─────────────────────────────────────────────────────────────

  /**
   * Login / register with Google popup.
   * Automatically creates user profile on first login.
   *
   * @param {string} defaultRole  Role to assign on first Google login
   * @returns {object}            { user, userDoc, isNewUser }
   */
  async function loginWithGoogle(defaultRole = "RIDER") {
    if (!_auth) throw new Error("Auth not initialized");
    const provider = new firebase.auth.GoogleAuthProvider();
    provider.addScope("profile");
    provider.addScope("email");

    const result = await _auth.signInWithPopup(provider);
    const user   = result.user;
    const isNew  = result.additionalUserInfo?.isNewUser || false;

    const ref   = _db.collection("users").doc(user.uid);
    const snap  = await ref.get();

    let userDoc;
    if (!snap.exists) {
      userDoc = {
        uid:          user.uid,
        name:         user.displayName || "",
        email:        user.email || "",
        phone:        user.phoneNumber || "",
        profileImage: user.photoURL || "",
        role:         defaultRole,
        status:       "ACTIVE",
        createdAt:    firebase.firestore.FieldValue.serverTimestamp(),
        updatedAt:    firebase.firestore.FieldValue.serverTimestamp(),
      };
      await ref.set(userDoc);
    } else {
      userDoc = snap.data();
    }
    _userDoc = userDoc;
    return { user, userDoc, isNewUser: isNew };
  }

  // ── Sign Out ─────────────────────────────────────────────────────────────────

  async function signOut() {
    if (!_auth) return;
    await _auth.signOut();
    _user    = null;
    _userDoc = null;
  }

  // ── Token ────────────────────────────────────────────────────────────────────

  /**
   * Get current user's ID token for API calls.
   * Firebase automatically refreshes expired tokens.
   *
   * @returns {string|null}
   */
  async function getIdToken() {
    if (!_user) return null;
    return _user.getIdToken(/* forceRefresh */ false);
  }

  /**
   * Build Authorization header for API requests.
   * @returns {object}  { Authorization: "Bearer <token>" }
   */
  async function getAuthHeaders() {
    const token = await getIdToken();
    if (!token) return {};
    return { Authorization: `Bearer ${token}` };
  }

  // ── State Accessors ───────────────────────────────────────────────────────────

  const getCurrentUser    = () => _user;
  const getCurrentUserDoc = () => _userDoc;
  const isAuthenticated   = () => !!_user;
  const isDriver          = () => _userDoc?.role === "DRIVER";
  const isRider           = () => _userDoc?.role === "RIDER";
  const isAdmin           = () => _userDoc?.role === "ADMIN";

  /**
   * Subscribe to auth state changes.
   * @param {function} callback  Called with (firebaseUser, userDoc) on change
   * @returns {function}         Unsubscribe function
   */
  function onAuthChange(callback) {
    _listeners.push(callback);
    // Immediately notify with current state
    callback(_user, _userDoc);
    return () => {
      _listeners = _listeners.filter((cb) => cb !== callback);
    };
  }

  // ── Public API ────────────────────────────────────────────────────────────────
  return {
    init,
    registerWithEmail,
    loginWithEmail,
    loginWithGoogle,
    signOut,
    getIdToken,
    getAuthHeaders,
    getCurrentUser,
    getCurrentUserDoc,
    isAuthenticated,
    isDriver,
    isRider,
    isAdmin,
    onAuthChange,
  };
})();

// Make available globally in browser
if (typeof window !== "undefined") {
  window.TripLinkAuth = TripLinkAuth;
}

// Also export for Node/bundler environments
if (typeof module !== "undefined" && module.exports) {
  module.exports = TripLinkAuth;
}
