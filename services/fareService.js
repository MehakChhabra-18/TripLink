/**
 * Fare Service — Production-grade, multi-tier distance calculation
 *
 * Tier 1: Google Distance Matrix      — exact driving distance (needs Billing enabled)
 * Tier 2: OSM Nominatim + OSRM       — exact driving distance via OSM road network (FREE, no key)
 * Tier 3: OSM Nominatim + Haversine  — straight-line estimate (last resort, never fails)
 *
 * Tier 2 is the primary free path for production. It geocodes addresses via Nominatim,
 * then routes between them with OSRM (router.project-osrm.org) for actual road distance.
 */
const https = require("https");

const BASE_FARE = 30;
const PER_KM    = 12;

function getKey() {
  return process.env.GOOGLE_MAPS_API;
}

// ─── Helper: HTTPS GET → parsed JSON (with timeout) ──────────────────────────
function httpsGetJSON(url, options = {}) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, options, (res) => {
      let body = "";
      res.on("data", (c) => { body += c; });
      res.on("end", () => {
        try { resolve(JSON.parse(body)); }
        catch (e) { reject(new Error("JSON parse error: " + e.message)); }
      });
    });
    req.on("error", reject);
    req.setTimeout(10000, () => req.destroy(new Error("Request timed out")));
  });
}

// ─── Haversine straight-line distance (last resort only) ─────────────────────
function haversineKm(lat1, lng1, lat2, lng2) {
  const R  = 6371;
  const dL = ((lat2 - lat1) * Math.PI) / 180;
  const dl = ((lng2 - lng1) * Math.PI) / 180;
  const a  =
    Math.sin(dL / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dl / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 10) / 10;
}

// ─── Format duration seconds → readable text ─────────────────────────────────
function formatDuration(durationSec) {
  const mins = Math.round(durationSec / 60);
  if (mins < 60) return `${mins} mins`;
  return `${Math.floor(mins / 60)} hr ${mins % 60} mins`;
}

// ─── Detect "30.12345, 76.54321" coordinate strings (from browser GPS) ───────
function parseCoords(str) {
  const m = str.trim().match(/^(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)$/);
  if (m) return { lat: parseFloat(m[1]), lng: parseFloat(m[2]) };
  return null;
}

// ─── OSM Nominatim geocoding (free, no key) ───────────────────────────────────
async function nominatimGeocode(place) {
  // If already raw GPS coordinates, use them directly
  const coords = parseCoords(place);
  if (coords) {
    console.log(`  "${place}" → raw GPS coords [${coords.lat}, ${coords.lng}]`);
    return coords;
  }

  // Add ", India" for better disambiguation if not already specified
  const query = /india/i.test(place) ? place : `${place}, India`;

  // Fetch top 5 results, prefer specific settlement types over admin districts
  const url =
    `https://nominatim.openstreetmap.org/search` +
    `?q=${encodeURIComponent(query)}&format=json&limit=5&countrycodes=in&addressdetails=1`;

  const json = await httpsGetJSON(url, {
    headers: { "User-Agent": "TripLink-FareService/1.0 (production)" },
  });

  if (!json?.length) throw new Error(`Nominatim: no results for "${place}"`);

  // Prefer city/town/village over generic administrative boundaries
  const CITY_TYPES = ["city", "town", "village", "suburb", "hamlet", "locality", "neighbourhood"];
  const best =
    json.find(r => CITY_TYPES.includes(r.type) || CITY_TYPES.includes(r.addresstype)) ||
    json[0];

  console.log(`  Geocoded "${place}" → ${best.display_name.substring(0, 65)} [${best.type}]`);
  return { lat: parseFloat(best.lat), lng: parseFloat(best.lon) };
}

// ─── OSRM: actual road distance between two {lat,lng} points (free, no key) ──
// Uses router.project-osrm.org — real OpenStreetMap driving routes
async function osrmRoute(locA, locB) {
  // OSRM expects longitude FIRST, then latitude
  const url =
    `https://router.project-osrm.org/route/v1/driving/` +
    `${locA.lng},${locA.lat};${locB.lng},${locB.lat}` +
    `?overview=false`;

  const json = await httpsGetJSON(url, {
    headers: { "User-Agent": "TripLink-FareService/1.0" },
  });

  if (json.code !== "Ok" || !json.routes?.length) {
    throw new Error(`OSRM routing failed: ${json.code} — ${json.message || "no route found"}`);
  }

  const route = json.routes[0];
  const distanceKm  = Math.round((route.distance / 1000) * 10) / 10;
  const durationSec = Math.round(route.duration);
  const durationText = formatDuration(durationSec);

  return { distanceKm, durationSec, durationText };
}

// ─── TIER 1: Google Distance Matrix ──────────────────────────────────────────
async function tier1_GoogleDistanceMatrix(pickup, destination) {
  const key = getKey();
  if (!key) throw new Error("GOOGLE_MAPS_API key not set in .env");

  const url =
    `https://maps.googleapis.com/maps/api/distancematrix/json` +
    `?origins=${encodeURIComponent(pickup)}&destinations=${encodeURIComponent(destination)}` +
    `&mode=driving&units=metric&key=${key}`;

  const json    = await httpsGetJSON(url);
  const status  = json.rows?.[0]?.elements?.[0]?.status;
  const element = json.rows?.[0]?.elements?.[0];

  if (json.status !== "OK" || status !== "OK") {
    throw new Error(
      `Google Distance Matrix: ${json.status} / ${json.error_message || status}`
    );
  }

  return {
    distanceKm:   Math.round((element.distance.value / 1000) * 10) / 10,
    durationSec:  element.duration.value,
    durationText: element.duration.text,
    source:       "google",
  };
}

// ─── TIER 2: OSM Nominatim geocoding + OSRM actual road routing (FREE) ────────
async function tier2_NominatimOSRM(pickup, destination) {
  // Geocode both addresses in parallel
  const [locA, locB] = await Promise.all([
    nominatimGeocode(pickup),
    nominatimGeocode(destination),
  ]);

  // Get exact driving route from OSRM
  const route = await osrmRoute(locA, locB);
  return { ...route, source: "osrm" };
}

// ─── TIER 3: OSM Nominatim + Haversine (last resort — never fails if geocode works)
async function tier3_NominatimHaversine(pickup, destination) {
  const [locA, locB] = await Promise.all([
    nominatimGeocode(pickup),
    nominatimGeocode(destination),
  ]);

  const distanceKm  = haversineKm(locA.lat, locA.lng, locB.lat, locB.lng);
  const durationSec = Math.round((distanceKm / 40) * 3600);
  return {
    distanceKm,
    durationSec,
    durationText: formatDuration(durationSec) + " (est.)",
    source: "haversine",
  };
}

// ─── Calculate fare from distance ────────────────────────────────────────────
function calculateFare(distanceKm) {
  return Math.round(BASE_FARE + distanceKm * PER_KM);
}

// ─── Main export ─────────────────────────────────────────────────────────────
async function getDistanceAndFare(pickup, destination) {
  let result;

  // ── Tier 1: Google (exact, needs billing) ──────────────────────────────────
  try {
    result = await tier1_GoogleDistanceMatrix(pickup, destination);
    console.log(`✅ [Google] ${result.distanceKm} km | ${result.durationText}`);
  } catch (err1) {
    console.warn(`⚠️  [Google] ${err1.message.substring(0, 80)}`);

    // ── Tier 2: Nominatim + OSRM (exact, 100% free) ────────────────────────
    try {
      result = await tier2_NominatimOSRM(pickup, destination);
      console.log(`✅ [OSRM]   ${result.distanceKm} km | ${result.durationText}`);
    } catch (err2) {
      console.warn(`⚠️  [OSRM]  ${err2.message.substring(0, 80)}`);

      // ── Tier 3: Haversine estimate (last resort) ─────────────────────────
      try {
        result = await tier3_NominatimHaversine(pickup, destination);
        console.log(`✅ [Haversine] ${result.distanceKm} km | ${result.durationText}`);
      } catch (err3) {
        console.error(`❌ All providers failed: ${err3.message}`);
        throw new Error(
          `Could not determine distance between "${pickup}" and "${destination}". ` +
          `Please check the location names and try again.`
        );
      }
    }
  }

  const estimatedFare = calculateFare(result.distanceKm);
  return {
    distanceKm:   result.distanceKm,
    estimatedFare,
    durationText:  result.durationText,
    durationSec:   result.durationSec,
    source:        result.source,   // "google" | "osrm" | "haversine"
  };
}

module.exports = { getDistanceAndFare, calculateFare, BASE_FARE, PER_KM };
