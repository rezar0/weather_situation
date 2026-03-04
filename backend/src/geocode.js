// src/geocode.js
// Converts a user query (city name, zip code, address) → { lat, lon, displayName }
//
// Strategy:
//   1. If query looks like a US zip code → instant lookup in bundled zipcodes.json
//   2. Otherwise → Nominatim (OpenStreetMap) free geocoding API

import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load zip code database once at startup (~3MB, fast)
let ZIPCODES = null;
function getZipcodes() {
  if (!ZIPCODES) {
    const raw = readFileSync(join(__dirname, "zipcodes.json"), "utf8");
    ZIPCODES = JSON.parse(raw);
  }
  return ZIPCODES;
}

const NOMINATIM = "https://nominatim.openstreetmap.org/search";

export async function geocode(query) {
  const trimmed = query.trim();

  // ── Fast path: US zip code (5 digits) ────────────────────────────────────
  if (/^\d{5}$/.test(trimmed)) {
    const zip = parseInt(trimmed);
    const entry = getZipcodes().find((z) => z.zipcode === zip);
    if (entry) {
      return formatZipResult(entry);
    }
  }

  // ── Slow path: Nominatim geocoding API ───────────────────────────────────
  const params = new URLSearchParams({
    q: trimmed,
    format: "json",
    limit: 1,
    addressdetails: 1,
  });

  const res = await fetch(`${NOMINATIM}?${params}`, {
    headers: {
      "User-Agent": "IsThisWeatherNormal/1.0 (contact@isthisweathernormal.com)",
    },
  });

  if (!res.ok) throw new Error(`Geocoding failed: ${res.status}`);
  const data = await res.json();
  if (!data.length) throw new Error(`Location not found: ${trimmed}`);

  const place = data[0];
  const addr = place.address || {};

  return formatNominatimResult(place, addr);
}

function formatZipResult(entry) {
  return {
    lat: entry.latitude,
    lon: entry.longitude,
    displayName: `${entry.name}, ${entry.abbreviation}`,
    city: entry.name,
    state: entry.state,
    country: "US",
    cacheKey: `${entry.latitude.toFixed(2)},${entry.longitude.toFixed(2)}`,
    source: "zipcode",
  };
}

function formatNominatimResult(place, addr) {
  const lat = parseFloat(place.lat);
  const lon = parseFloat(place.lon);
  return {
    lat,
    lon,
    displayName: buildDisplayName(addr, place.display_name),
    city: addr.city || addr.town || addr.village || addr.county || "",
    state: addr.state || "",
    country: addr.country_code?.toUpperCase() || "",
    cacheKey: `${lat.toFixed(2)},${lon.toFixed(2)}`,
    source: "nominatim",
  };
}

function buildDisplayName(addr, fallback) {
  const parts = [
    addr.city || addr.town || addr.village || addr.county,
    addr.state,
    addr.country,
  ].filter(Boolean);
  return parts.length >= 2 ? parts.join(", ") : fallback.split(",").slice(0, 2).join(",").trim();
}
