const Ride = require("../models/Ride");
const { getDistanceAndFare, calculateFare } = require("../services/fareService");

// ─── GET FARE ESTIMATE ────────────────────────────────────────────────────────
exports.getFare = async (req, res) => {
  const { pickup, destination, drop } = req.query;
  const dest = destination || drop;

  if (!pickup || !dest) {
    return res.status(400).json({ error: "pickup and destination are required" });
  }

  try {
    const { distanceKm, estimatedFare, durationText } = await getDistanceAndFare(pickup, dest);
    res.json({ distanceKm, estimatedFare, durationText });
  } catch (err) {
    console.error("Fare estimate error:", err.message);
    res.status(500).json({ error: "Could not calculate fare. Check your location names and try again." });
  }
};

// ─── BOOK RIDE ────────────────────────────────────────────────────────────────
exports.bookRide = async (req, res) => {
  try {
    const { pickup, destination, drop, offeredFare } = req.body;
    const dest = destination || drop;

    if (!pickup || !dest || !offeredFare) {
      const msg = "pickup, destination, and offeredFare are required";
      if (req.headers.accept?.includes("application/json")) {
        return res.status(400).json({ error: msg });
      }
      return res.redirect("/rider/dashboard");
    }

    const riderId    = req.user?.id || req.session?.user?.id;
    const riderName  = req.user?.name || req.session?.user?.name;

    // ── Get REAL distance from Google Maps ─────────────────────────────
    let distanceKm, estimatedFare;
    try {
      ({ distanceKm, estimatedFare } = await getDistanceAndFare(pickup, dest));
    } catch (err) {
      console.error("Google Maps distance error (using fallback):", err.message);
      // Fallback: rough estimate if Google API fails
      distanceKm    = 5;
      estimatedFare = calculateFare(distanceKm);
    }

    const fare = Math.max(1, parseInt(offeredFare, 10));

    // Generate 4-digit ride-start OTP
    const rideOTP = String(Math.floor(1000 + Math.random() * 9000));

    const ride = await Ride.create({
      rider:         riderId,
      pickup,
      destination:   dest,
      distanceKm,
      estimatedFare,
      offeredFare:   fare,
      rideStatus:    "pending",
      rideOTP,
    });

    // Broadcast new ride to ALL connected drivers in real-time
    global.io.emit("newRide", {
      _id:           ride._id,
      pickup:        ride.pickup,
      destination:   ride.destination,
      drop:          ride.destination,   // backward-compat
      distanceKm:    ride.distanceKm,
      estimatedFare: ride.estimatedFare,
      offeredFare:   ride.offeredFare,
      riderName,
    });

    if (req.headers.accept?.includes("application/json")) {
      return res.status(201).json({ ride });
    }
    res.redirect("/rider/dashboard");
  } catch (err) {
    console.error("bookRide error:", err);
    if (req.headers.accept?.includes("application/json")) {
      return res.status(500).json({ error: err.message });
    }
    res.redirect("/rider/dashboard");
  }
};

// ─── UPDATE RIDE STATUS (driver accept / reject / start / complete / cancel) ─
exports.updateRideStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const driverId = req.user?.id || req.session?.user?.id;

    const allowed = ["accepted", "started", "completed", "cancelled", "rejected"];
    if (!allowed.includes(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }

    const update = { rideStatus: status };

    if (status === "accepted") {
      update.driver     = driverId;
      update.acceptedAt = new Date();
    } else if (status === "started") {
      update.startedAt = new Date();
    } else if (status === "completed") {
      update.completedAt = new Date();
    }

    const ride = await Ride.findByIdAndUpdate(id, update, { new: true });
    if (!ride) return res.status(404).json({ error: "Ride not found" });

    // Socket.io notifications
    if (status === "accepted") {
      global.io.to(ride.rider.toString()).emit("rideAccepted", {
        driverName: req.user?.name || req.session?.user?.name,
        driverId:   driverId,   // ← rider uses this to emit their location back
        rideId:     ride._id,
      });
      global.io.emit("rideGone", { rideId: ride._id.toString() });
    } else if (status === "rejected") {
      global.io.to(ride.rider.toString()).emit("rideRejected", { rideId: ride._id });
      global.io.emit("rideGone", { rideId: ride._id.toString() });
    } else if (status === "completed" || status === "cancelled") {
      global.io.to(ride.rider.toString()).emit("rideStatusUpdate", { status, rideId: ride._id });
    }

    if (req.headers.accept?.includes("application/json")) {
      return res.json({ ride });
    }
    res.redirect("/driver/dashboard");
  } catch (err) {
    console.error("updateRideStatus error:", err);
    if (req.headers.accept?.includes("application/json")) {
      return res.status(500).json({ error: err.message });
    }
    res.redirect("/driver/dashboard");
  }
};

// ─── VERIFY RIDE-START OTP ────────────────────────────────────────────────────
exports.verifyOTP = async (req, res) => {
  try {
    const { rideId, otp } = req.body;

    const ride = await Ride.findById(rideId);
    if (!ride) return res.status(404).json({ error: "Ride not found" });

    if (ride.rideOTP !== String(otp)) {
      return res.status(400).json({ success: false, message: "Invalid OTP" });
    }

    ride.otpVerified = true;
    ride.rideStatus  = "started";
    ride.startedAt   = new Date();
    await ride.save();

    global.io.to(ride.rider.toString()).emit("rideStatusUpdate", {
      status: "started",
      rideId: ride._id,
    });

    res.json({ success: true, message: "OTP verified. Ride started!" });
  } catch (err) {
    console.error("verifyOTP error:", err);
    res.status(500).json({ error: err.message });
  }
};

// ─── GET RIDE HISTORY (for rider) ────────────────────────────────────────────
exports.getRideHistory = async (req, res) => {
  try {
    const riderId = req.user?.id || req.session?.user?.id;

    const rides = await Ride.find({ rider: riderId })
      .populate("driver", "name phone carModel")
      .sort({ createdAt: -1 })
      .lean();

    if (req.headers.accept?.includes("application/json")) {
      return res.json({ rides });
    }
    // For EJS routes, this is handled separately in rider router
    res.json({ rides });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ─── GET PENDING RIDES (for driver) ──────────────────────────────────────────
exports.getPendingRides = async (req, res) => {
  try {
    const rides = await Ride.find({ rideStatus: "pending" })
      .populate("rider", "name phone")
      .sort({ createdAt: -1 })
      .lean();

    res.json({ rides });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ─── GET ACTIVE RIDE (for driver — their current accepted/started ride) ───────
exports.getActiveRide = async (req, res) => {
  try {
    const driverId = req.user?.id || req.session?.user?.id;

    const ride = await Ride.findOne({
      driver:     driverId,
      rideStatus: { $in: ["accepted", "started"] },
    })
      .populate("rider", "name phone")
      .lean();

    res.json({ ride: ride || null });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ─── RIDER DASHBOARD (EJS SSR) ───────────────────────────────────────────────
// GET /rider/dashboard
exports.getRiderDashboard = async (req, res) => {
  try {
    const riderId = req.session.user.id;

    // ⚠️ Don't use .lean() — we need Mongoose virtuals (drop → destination)
    const rides = await Ride.find({ rider: riderId })
      .populate("driver", "name phone carModel")
      .sort({ createdAt: -1 });

    const activeRideDoc = rides.find(r =>
      ["pending", "accepted", "started"].includes(r.rideStatus)
    );
    const rideHistory = rides.filter(r =>
      ["completed", "cancelled", "rejected"].includes(r.rideStatus)
    );

    // Convert to plain object WITH virtuals, add explicit destination field
    const activeRide = activeRideDoc
      ? {
          ...activeRideDoc.toObject({ virtuals: true }),
          destination: activeRideDoc.destination,
          drop:        activeRideDoc.destination, // explicit fallback
        }
      : null;

    res.render("riderDashboard", {
      user:          req.session.user,
      activeRide,
      rideHistory,
      googleMapsKey: process.env.GOOGLE_MAPS_API || "",
    });
  } catch (err) {
    console.error("Rider dashboard error:", err);
    res.redirect("/");
  }
};

