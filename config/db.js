// Force Google DNS for MongoDB SRV resolution on restricted networks
require("dns").setServers(["8.8.8.8", "8.8.4.4", "1.1.1.1"]);

const mongoose = require("mongoose");

const connectDB = async () => {
  const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/triplink";

  const options = {
    serverSelectionTimeoutMS: 10000,  // wait 10s before giving up
    socketTimeoutMS: 45000,
  };

  try {
    await mongoose.connect(MONGO_URI, options);
    console.log("✅ MongoDB connected successfully");
  } catch (err) {
    console.error("❌ MongoDB connection error:", err.message);
    console.error("\n💡 Troubleshooting tips:");
    console.error("   1. Check your MONGO_URI in .env");
    console.error("   2. MongoDB Atlas → Network Access → IP Whitelist → Add 0.0.0.0/0");
    console.error("   3. Try changing DNS to 8.8.8.8 (Google DNS) if on restricted network");
    console.error("   4. Try running: nslookup cluster0.uw94stc.mongodb.net");
    console.error("\n⚠️  Falling back to local MongoDB (mongodb://127.0.0.1:27017/triplink)...\n");

    // Try local MongoDB as fallback
    try {
      await mongoose.connect("mongodb://127.0.0.1:27017/triplink", options);
      console.log("✅ Connected to local MongoDB (fallback)");
    } catch (localErr) {
      console.error("❌ Local MongoDB also failed:", localErr.message);
      console.error("   Make sure MongoDB is running locally OR fix your Atlas URI.");
      process.exit(1);
    }
  }
};

module.exports = connectDB;
