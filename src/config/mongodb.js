/**
 * MongoDB connection (kept for real-time/tracking data and legacy support)
 * Uses Mongoose
 */
const mongoose = require("mongoose");
const dns = require("dns");

// Force Google DNS for Atlas SRV lookups on restricted networks
dns.setServers(["8.8.8.8", "8.8.4.4", "1.1.1.1"]);

const connectMongoDB = async () => {
  const uri = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/triplink";

  try {
    await mongoose.connect(uri);
    console.log("✅ MongoDB connected");
  } catch (err) {
    console.error("❌ MongoDB connection failed:", err.message);
    // Non-fatal — PostgreSQL is primary DB
  }
};

mongoose.connection.on("disconnected", () => {
  console.warn("⚠️  MongoDB disconnected");
});

module.exports = { connectMongoDB };
