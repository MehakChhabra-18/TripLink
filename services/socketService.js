const https = require("https");

/**
 * Fetch ETA in seconds from Google Maps Distance Matrix API (server-side)
 * @param {number} driverLat
 * @param {number} driverLng
 * @param {string} destinationAddress  – pickup address of the ride
 * @returns {Promise<{durationSec: number, durationText: string, distanceText: string} | null>}
 */
function fetchETA(driverLat, driverLng, destinationAddress) {
  return new Promise((resolve) => {
    const key     = process.env.GOOGLE_MAPS_API;
    const origin  = `${driverLat},${driverLng}`;
    const dest    = encodeURIComponent(destinationAddress);
    const url     = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${origin}&destinations=${dest}&mode=driving&units=metric&key=${key}`;

    https.get(url, (res) => {
      let body = "";
      res.on("data", (chunk) => { body += chunk; });
      res.on("end", () => {
        try {
          const json  = JSON.parse(body);
          const elem  = json.rows?.[0]?.elements?.[0];
          if (elem && elem.status === "OK") {
            resolve({
              durationSec:  elem.duration.value,
              durationText: elem.duration.text,
              distanceText: elem.distance.text,
            });
          } else {
            resolve(null);
          }
        } catch { resolve(null); }
      });
    }).on("error", () => resolve(null));
  });
}

/**
 * Initialize all Socket.io event handlers
 * @param {import("socket.io").Server} io
 */
function initSocket(io) {
  io.on("connection", (socket) => {
    console.log("🟢 User connected:", socket.id);

    // User joins their personal room (for targeted notifications)
    socket.on("join", (userId) => {
      socket.join(userId);
      console.log(`👤 User ${userId} joined room`);
    });

    // ── Driver broadcasts GPS location ───────────────────────────────────────
    // data: { rideId, lat, lng, riderId, pickupAddress }
    socket.on("driver-location", async (data) => {
      // 1. Forward raw location to rider immediately
      if (data.riderId) {
        io.to(data.riderId).emit("update-driver-location", data);
      } else {
        io.emit("update-driver-location", data);
      }

      // 2. Compute ETA server-side and send to rider
      if (data.riderId && data.pickupAddress && data.lat && data.lng) {
        try {
          const eta = await fetchETA(data.lat, data.lng, data.pickupAddress);
          if (eta) {
            io.to(data.riderId).emit("eta-update", {
              rideId:       data.rideId,
              durationSec:  eta.durationSec,
              durationText: eta.durationText,
              distanceText: eta.distanceText,
              driverLat:    data.lat,
              driverLng:    data.lng,
            });
          }
        } catch (e) {
          // silently fail — ETA is best-effort
        }
      }
    });

    // Rider broadcasts their live location to the driver's room
    socket.on("rider-location", (data) => {
      // data: { rideId, lat, lng, driverId }
      if (data.driverId) {
        io.to(data.driverId).emit("update-rider-location", data);
      } else {
        io.emit("update-rider-location", data);
      }
    });

    // Driver goes online/offline
    socket.on("driver-availability", (data) => {
      // data: { driverId, isAvailable }
      io.emit("driver-status-change", data);
    });

    socket.on("disconnect", () => {
      console.log("🔴 User disconnected:", socket.id);
    });
  });
}

module.exports = { initSocket };

