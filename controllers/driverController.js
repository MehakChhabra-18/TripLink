const prisma = require("../src/config/prisma");

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
    paymentStatus: r.paymentStatus.toLowerCase(),
    rider: r.rider?.user ? { name: r.rider.user.name, phone: r.rider.user.phone } : null
  };
};

// ─── DRIVER DASHBOARD (EJS SSR) ───────────────────────────────────────────────
exports.getDashboard = async (req, res) => {
  try {
    const userId = req.session.user.id;
    const driver = await prisma.driver.findUnique({ where: { userId }, include: { user: true } });
    if (!driver) return res.redirect("/");

    // Pending rides for other drivers to accept
    const pendingRidesRaw = await prisma.ride.findMany({
      where: { status: "PENDING" },
      include: { rider: { include: { user: true } } },
      orderBy: { createdAt: "desc" }
    });

    // This driver's currently active ride (accepted, started, or completed but unpaid)
    const activeRideRaw = await prisma.ride.findFirst({
      where: {
        driverId: driver.id,
        OR: [
          { status: { in: ["ACCEPTED", "STARTED"] } },
          { status: "COMPLETED", paymentStatus: { not: "PAID" } }
        ]
      },
      include: { rider: { include: { user: true } } }
    });

    // Driver's recently completed and paid rides
    const completedRidesRaw = await prisma.ride.findMany({
      where: {
        driverId: driver.id,
        status: "COMPLETED",
        paymentStatus: "PAID"
      },
      include: { rider: { include: { user: true } } },
      orderBy: { updatedAt: "desc" },
      take: 5
    });

    const pendingRides = pendingRidesRaw.map(mapRideToMongoose);
    const activeRide = mapRideToMongoose(activeRideRaw);
    const completedRides = completedRidesRaw.map(mapRideToMongoose);

    res.render("driverDashboard", {
      user: {
        ...req.session.user,
        isAvailable: driver.isAvailable
      },
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
    const userId = req.session.user.id;
    const driver = await prisma.driver.findUnique({ where: { userId } });
    if (!driver) throw new Error("Driver profile not found");

    const newAvailable = !driver.isAvailable;
    await prisma.driver.update({
      where: { id: driver.id },
      data: { isAvailable: newAvailable }
    });

    req.session.user.isAvailable = newAvailable;

    global.io?.emit("driver-status-change", {
      driverId:    driver.id,
      isAvailable: newAvailable,
    });

    if (req.headers.accept?.includes("application/json")) {
      return res.json({ isAvailable: newAvailable });
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
    const userId = req.user?.id || req.session?.user?.id;
    const driver = await prisma.driver.findUnique({ where: { userId } });
    if (!driver) return res.status(404).json({ error: "Driver not found" });

    const completedRides = await prisma.ride.findMany({
      where: {
        driverId: driver.id,
        status: "COMPLETED",
      }
    });

    const totalEarnings = completedRides.reduce((sum, r) => sum + (r.offeredFare || 0), 0);

    res.json({
      totalRides:    completedRides.length,
      totalEarnings,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
