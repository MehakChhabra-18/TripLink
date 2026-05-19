/**
 * Driver Location Tracking Socket Handlers
 */
const https = require("https");

/**
 * Fetch ETA via Google Maps Distance Matrix API (server-side)
 */
function fetchETA(driverLat, driverLng, destinationAddress) {
  return new Promise((resolve) => {
    const key    = process.env.GOOGLE_MAPS_API;
    if (!key) return resolve(null);

    const origin = `${driverLat},${driverLng}`;
    const dest   = encodeURIComponent(destinationAddress);
    const url    = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${origin}&destinations=${dest}&mode=driving&units=metric&key=${key}`;

    https.get(url, (res) => {
      let body = "";
      res.on("data", (c) => { body += c; });
      res.on("end", () => {
        try {
          const json = JSON.parse(body);
          const elem = json.rows?.[0]?.elements?.[0];
          if (elem && elem.status === "OK") {
            resolve({
              durationSec:  elem.duration.value,
              durationText: elem.duration.text,
              distanceText: elem.distance.text,
            });
          } else resolve(null);
        } catch { resolve(null); }
      });
    }).on("error", () => resolve(null));
  });
}

/**
 * Register driver location tracking handlers
 * @param {import("socket.io").Server} io
 * @param {import("socket.io").Socket} socket
 */
const registerTrackingHandlers = (io, socket) => {
  /**
   * Driver broadcasts GPS coordinates
   * data: { rideId, lat, lng, riderId, pickupAddress, speed?, heading? }
   */
  socket.on("driver-location", async (data) => {
    const { rideId, lat, lng, riderId, pickupAddress } = data;

    // Validate coordinates
    if (!lat || !lng || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
      return;
    }

    // Forward raw location to rider
    if (riderId) {
      io.to(riderId).emit("update-driver-location", { rideId, lat, lng });
    }

    // Compute ETA server-side
    if (riderId && pickupAddress && lat && lng) {
      try {
        const eta = await fetchETA(lat, lng, pickupAddress);
        if (eta) {
          io.to(riderId).emit("eta-update", {
            rideId,
            durationSec:  eta.durationSec,
            durationText: eta.durationText,
            distanceText: eta.distanceText,
            driverLat:    lat,
            driverLng:    lng,
          });
        }
      } catch {
        // ETA is best-effort, don't crash
      }
    }
  });

  /**
   * Rider shares their location with driver
   * data: { rideId, lat, lng, driverId }
   */
  socket.on("rider-location", (data) => {
    const { driverId, lat, lng, rideId } = data;
    if (!lat || !lng) return;

    if (driverId) {
      io.to(driverId).emit("update-rider-location", { rideId, lat, lng });
    }
  });
};

module.exports = { registerTrackingHandlers };
