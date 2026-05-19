const prisma = require("../src/config/prisma");
const { getDistanceAndFare, calculateFare } = require("../services/fareService");

// ─── Helpers ──────────────────────────────────────────────────────────────────
const mapRideToMongoose = (r) => {
  if (!r) return null;
  return {
    ...r,
    _id: r.id,
    destination: r.destinationAddress,
    drop: r.destinationAddress,
    pickup: r.pickupAddress,
    rideStatus: r.status.toLowerCase(),
    driver: r.driver?.user ? { 
      _id: r.driver.userId,
      name: r.driver.user.name, 
      phone: r.driver.user.phone, 
      carModel: "Standard" 
    } : null,
    rider: r.rider?.user ? { 
      _id: r.rider.userId,
      name: r.rider.user.name, 
      phone: r.rider.user.phone 
    } : null
  };
};

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
      if (req.headers.accept?.includes("application/json")) return res.status(400).json({ error: msg });
      return res.redirect("/rider/dashboard");
    }

    const riderId = req.user?.id || req.session?.user?.id;
    const riderName = req.user?.name || req.session?.user?.name;

    let distanceKm, estimatedFare;
    try {
      ({ distanceKm, estimatedFare } = await getDistanceAndFare(pickup, dest));
    } catch (err) {
      distanceKm = 5;
      estimatedFare = calculateFare(distanceKm);
    }

    const fare = Math.max(1, parseInt(offeredFare, 10));
    const rideOTP = String(Math.floor(1000 + Math.random() * 9000));

    // Get the Rider ID from User ID
    const rider = await prisma.rider.findUnique({ where: { userId: riderId } });
    if (!rider) throw new Error("Rider profile not found");

    const ride = await prisma.ride.create({
      data: {
        riderId: rider.id,
        pickupAddress: pickup,
        destinationAddress: dest,
        distanceKm,
        estimatedFare,
        offeredFare: fare,
        status: "PENDING",
        rideOTP,
      }
    });

    const mappedRide = mapRideToMongoose(ride);

    global.io?.emit("newRide", {
      ...mappedRide,
      riderName,
    });

    if (req.headers.accept?.includes("application/json")) return res.status(201).json({ ride: mappedRide });
    res.redirect("/rider/dashboard");
  } catch (err) {
    console.error("bookRide error:", err);
    if (req.headers.accept?.includes("application/json")) return res.status(500).json({ error: err.message });
    res.redirect("/rider/dashboard");
  }
};

// ─── UPDATE RIDE STATUS ───────────────────────────────────────────────────────
exports.updateRideStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const driverUserId = req.user?.id || req.session?.user?.id;

    const allowed = ["accepted", "started", "completed", "cancelled", "rejected"];
    if (!allowed.includes(status)) return res.status(400).json({ error: "Invalid status" });

    const data = { status: status.toUpperCase() };

    if (status === "accepted") {
      const driver = await prisma.driver.findUnique({ where: { userId: driverUserId } });
      if(driver) data.driverId = driver.id;
      data.acceptedAt = new Date();
    } else if (status === "started") {
      data.startedAt = new Date();
    } else if (status === "completed") {
      data.completedAt = new Date();
    }

    const ride = await prisma.ride.update({
      where: { id },
      data,
      include: { rider: true }
    });

    const mappedRide = mapRideToMongoose(ride);

    if (status === "accepted") {
      global.io?.to(ride.rider.userId).emit("rideAccepted", {
        driverName: req.user?.name || req.session?.user?.name,
        driverId:   driverUserId,
        rideId:     ride.id,
      });
      global.io?.emit("rideGone", { rideId: ride.id });
    } else if (status === "rejected") {
      global.io?.to(ride.rider.userId).emit("rideRejected", { rideId: ride.id });
      global.io?.emit("rideGone", { rideId: ride.id });
    } else if (status === "completed" || status === "cancelled") {
      global.io?.to(ride.rider.userId).emit("rideStatusUpdate", { status, rideId: ride.id });
    }

    if (req.headers.accept?.includes("application/json") || req.method === "PUT" || req.headers["content-type"] === "application/json") {
      return res.json({ success: true, ride: mappedRide });
    }
    res.redirect("/driver/dashboard");
  } catch (err) {
    console.error("updateRideStatus error:", err);
    if (req.headers.accept?.includes("application/json") || req.method === "PUT" || req.headers["content-type"] === "application/json") {
      return res.status(500).json({ error: err.message });
    }
    res.redirect("/driver/dashboard");
  }
};

// ─── VERIFY OTP ───────────────────────────────────────────────────────────────
exports.verifyOTP = async (req, res) => {
  try {
    const { rideId, otp } = req.body;
    const ride = await prisma.ride.findUnique({ where: { id: rideId }, include: { rider: true } });
    
    if (!ride) return res.status(404).json({ error: "Ride not found" });
    if (ride.rideOTP !== String(otp)) return res.status(400).json({ success: false, message: "Invalid OTP" });

    await prisma.ride.update({
      where: { id: rideId },
      data: { otpVerified: true, status: "STARTED", startedAt: new Date() }
    });

    global.io?.to(ride.rider.userId).emit("rideStatusUpdate", { status: "started", rideId });
    res.json({ success: true, message: "OTP verified. Ride started!" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ─── RIDER DASHBOARD (EJS SSR) ───────────────────────────────────────────────
exports.getRiderDashboard = async (req, res) => {
  try {
    const riderUserId = req.session.user.id;
    const rider = await prisma.rider.findUnique({ where: { userId: riderUserId } });
    if (!rider) return res.redirect("/");

    const rides = await prisma.ride.findMany({
      where: { riderId: rider.id },
      include: { driver: { include: { user: true } } },
      orderBy: { createdAt: 'desc' }
    });

    const mappedRides = rides.map(mapRideToMongoose);

    const activeRide = mappedRides.find(r => ["pending", "accepted", "started"].includes(r.rideStatus));
    const rideHistory = mappedRides.filter(r => ["completed", "cancelled", "rejected"].includes(r.rideStatus));

    res.render("riderDashboard", {
      user:          req.session.user,
      activeRide:    activeRide || null,
      rideHistory,
      googleMapsKey: process.env.GOOGLE_MAPS_API || "",
    });
  } catch (err) {
    console.error("Rider dashboard error:", err);
    res.redirect("/");
  }
};

exports.getRideHistory = async (req, res) => {
  res.json({ rides: [] });
};
exports.getPendingRides = async (req, res) => {
  res.json({ rides: [] });
};
exports.getActiveRide = async (req, res) => {
  res.json({ ride: null });
};

