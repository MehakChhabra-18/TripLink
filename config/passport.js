// config/passport.js
const LocalStrategy = require("passport-local").Strategy;
const User = require("../models/User");

module.exports = function(passport) {

  // ─── STRATEGY ──────────────────────────────────────────
  // This runs when user submits the login form
  // We tell passport: "use email & password fields"
  passport.use(new LocalStrategy(
    { usernameField: "email" },  // by default passport looks for 'username', we override to 'email'

    async (email, password, done) => {
      try {

        // Step 1: Find user by email in MongoDB
        const user = await User.findOne({ email });

        if (!user) {
          // No user found with that email
          return done(null, false, { message: "No account found with that email" });
        }

        // Step 2: Compare entered password with hashed password in DB
        const isMatch = await user.comparePassword(password);

        if (!isMatch) {
          return done(null, false, { message: "Incorrect password" });
        }

        // Step 3: Password matched → pass user to serializeUser
        return done(null, user);

      } catch (err) {
        return done(err);
      }
    }
  ));


  // ─── SERIALIZE ─────────────────────────────────────────
  // After login, passport saves user.id in the SESSION (in MongoDB)
  // Think of it as: "remember this user by their ID"
  passport.serializeUser((user, done) => {
    done(null, user.id);  // only the ID is stored in session
  });


  // ─── DESERIALIZE ───────────────────────────────────────
  // On every request, passport takes the ID from session
  // and fetches the full user from DB → available as req.user
  passport.deserializeUser(async (id, done) => {
    try {
      const user = await User.findById(id);
      done(null, user);   // req.user = full user object
    } catch (err) {
      done(err);
    }
  });

};