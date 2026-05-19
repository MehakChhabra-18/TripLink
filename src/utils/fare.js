/**
 * Fare Utility — Real Google Maps Distance Matrix
 * Replaces the fake hash-based estimation
 */
const https = require("https");

const BASE_FARE  = 30;
const PER_KM     = 12;

/**
 * Get real driving distance from Google Distance Matrix API
 */
const getRealDistance = (pickup, destination) =>
  new Promise((resolve, reject) => {
    const key = process.env.GOOGLE_MAPS_API;
    if (!key) return reject(new Error("GOOGLE_MAPS_API key not set"));

    const url =
      `https://maps.googleapis.com/maps/api/distancematrix/json` +
      `?origins=${encodeURIComponent(pickup)}` +
      `&destinations=${encodeURIComponent(destination)}` +
      `&mode=driving&units=metric&key=${key}`;

    https.get(url, (res) => {
      let body = "";
      res.on("data", (c) => { body += c; });
      res.on("end", () => {
        try {
          const json    = JSON.parse(body);
          const element = json.rows?.[0]?.elements?.[0];
          if (json.status !== "OK" || element?.status !== "OK") {
            return reject(new Error(`Maps error: ${json.status} / ${element?.status}`));
          }
          resolve({
            distanceKm:  Math.round((element.distance.value / 1000) * 10) / 10,
            durationSec: element.duration.value,
            durationText: element.duration.text,
          });
        } catch (e) { reject(e); }
      });
    }).on("error", reject);
  });

/**
 * Calculate fare from distance
 */
const calculateFare = (distanceKm) =>
  Math.round(BASE_FARE + distanceKm * PER_KM);

/**
 * Main export — get real distance + fare
 */
const estimateRideFare = async (pickup, destination) => {
  const { distanceKm, durationText, durationSec } = await getRealDistance(pickup, destination);
  return { distanceKm, estimatedFare: calculateFare(distanceKm), durationText, durationSec };
};

module.exports = { estimateRideFare, calculateFare, getRealDistance, BASE_FARE, PER_KM };
