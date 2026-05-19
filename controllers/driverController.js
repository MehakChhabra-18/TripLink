const User = require("../models/User");
const Ride = require("../models/Ride");

// ─── DRIVER DASHBOARD (EJS SSR) ───────────────────────────────────────────────
exports.getDashboard = async (req, res) => {
  try {
    const driverId = req.session.user.id;

    // Pending rides for other drivers to accept
    const pendingRides = await Ride.find({ rideStatus: "pending" })
      .populate("rider", "name phone")
      .sort({ createdAt: -1 })
      .lean();

    // This driver's currently active ride (accepted, started, or completed but unpaid)
    const activeRide = await Ride.findOne({
      driver: driverId,
      $or: [
        { rideStatus: { $in: ["accepted", "started"] } },
        { rideStatus: "completed", paymentStatus: { $ne: "paid" } }
      ]
    })
      .populate("rider", "name phone")
      .lean();

    // Driver's recently completed and paid rides
    const completedRides = await Ride.find({
      driver: driverId,
      rideStatus: "completed",
      paymentStatus: "paid"
    })
      .populate("rider", "name")
      .sort({ updatedAt: -1 })
      .limit(5)
      .lean();

    res.render("driverDashboard", {
      user:         req.session.user,
      pendingRides,
      activeRide:   activeRide || null,
      completedRides,
    });
  } catch (err) {
    console.error("Driver dashboard error:", err);
    res.redirect("/");
  }
};


// ─── TOGGLE AVAILABILITY ──────────────────────────────────────────────────────
exports.toggleAvailability = async (req, res) => {
  try {
    const user = await User.findById(req.session.user.id);
    user.isAvailable = !user.isAvailable;
    await user.save();

    req.session.user.isAvailable = user.isAvailable;

    // Notify all clients of driver status change
    global.io.emit("driver-status-change", {
      driverId:    user._id.toString(),
      isAvailable: user.isAvailable,
    });

    if (req.headers.accept?.includes("application/json")) {
      return res.json({ isAvailable: user.isAvailable });
    }
    res.redirect("/driver/dashboard");
  } catch (err) {
    console.error("toggleAvailability error:", err);
    if (req.headers.accept?.includes("application/json")) {
      return res.status(500).json({ error: err.message });
    }
    res.redirect("/driver/dashboard");
  }
};

// ─── GET DRIVER STATS (API) ───────────────────────────────────────────────────
exports.getStats = async (req, res) => {
  try {
    const driverId = req.user?.id || req.session?.user?.id;

    const completedRides = await Ride.find({
      driver:     driverId,
      rideStatus: "completed",
    }).lean();

    const totalEarnings = completedRides.reduce((sum, r) => sum + (r.offeredFare || 0), 0);

    res.json({
      totalRides:    completedRides.length,
      totalEarnings,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
