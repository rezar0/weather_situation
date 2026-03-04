// src/geocode.js
// Converts a user query (city name, zip code, address) → { lat, lon, displayName }
// Uses the free Nominatim API (OpenStreetMap) — no key required.

const NOMINATIM = "https://nominatim.openstreetmap.org/search";

export async function geocode(query) {
  const params = new URLSearchParams({
    q: query,
    format: "json",
    limit: 1,
    addressdetails: 1,
  });

  const res = await fetch(`${NOMINATIM}?${params}`, {
    headers: {
      // Nominatim requires a descriptive User-Agent
      "User-Agent": "IsThisWeatherNormal/1.0 (contact@isthisweathernormal.com)",
    },
  });

  if (!res.ok) throw new Error(`Geocoding failed: ${res.status}`);
  const data = await res.json();
  if (!data.length) throw new Error(`Location not found: ${query}`);

  const place = data[0];
  const addr = place.address || {};

  return {
    lat: parseFloat(place.lat),
    lon: parseFloat(place.lon),
    displayName: buildDisplayName(addr, place.display_name),
    city: addr.city || addr.town || addr.village || addr.county || "",
    state: addr.state || "",
    country: addr.country_code?.toUpperCase() || "",
    // Round to 2 decimal places for cache key (≈1km grid)
    cacheKey: `${parseFloat(place.lat).toFixed(2)},${parseFloat(place.lon).toFixed(2)}`,
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
