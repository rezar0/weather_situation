// src/cache.js
// Upstash Redis caching layer.
// Cache keys and TTLs:
//   geo:{query}           → geocoded location        TTL: 7 days
//   current:{cacheKey}    → current + forecast       TTL: 30 min
//   thisyear:{cacheKey}   → this year daily data     TTL: 6 hours
//   climate:{cacheKey}    → 30yr normals             TTL: 30 days
//   locations:all         → set of all unique cacheKeys (for count)
//   locations:recent      → list of last 6 successful searches (ordered, no dupes)

import { Redis } from "@upstash/redis";

let redis = null;

function getRedis() {
  if (!redis) {
    if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
      return null;
    }
    redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });
  }
  return redis;
}

export async function cacheGet(key) {
  const r = getRedis();
  if (!r) return null;
  try {
    return await r.get(key);
  } catch (e) {
    console.warn("Cache GET failed:", e.message);
    return null;
  }
}

export async function cacheSet(key, value, ttlSeconds) {
  const r = getRedis();
  if (!r) return;
  try {
    await r.set(key, JSON.stringify(value), { ex: ttlSeconds });
  } catch (e) {
    console.warn("Cache SET failed:", e.message);
  }
}

export async function cacheGetParsed(key) {
  const raw = await cacheGet(key);
  if (!raw) return null;
  try {
    return typeof raw === "string" ? JSON.parse(raw) : raw;
  } catch {
    return null;
  }
}

// Called after a SUCCESSFUL weather response — records location
// and pushes to the recents list (no dupes, max 6).
export async function recordLocation(location) {
  const r = getRedis();
  if (!r) return;
  try {
    // Store full location metadata keyed by cacheKey
    await r.set(`loc:${location.cacheKey}`, JSON.stringify({
      ...location,
      lastSearched: new Date().toISOString(),
    }));

    // Track all-time unique locations (for /health count)
    await r.sadd("locations:all", location.cacheKey);

    // ── Recents list (ordered, no dupes, max 6) ──────────────────────────
    // Remove this location if it already exists in the list (prevents dupes)
    await r.lrem("locations:recent", 0, location.cacheKey);
    // Push to front
    await r.lpush("locations:recent", location.cacheKey);
    // Trim to 6
    await r.ltrim("locations:recent", 0, 5);
  } catch (e) {
    console.warn("recordLocation failed:", e.message);
  }
}

// Returns the last 6 successfully searched locations as display objects
export async function getRecentLocations() {
  const r = getRedis();
  if (!r) return [];
  try {
    // Get the 6 most recent cacheKeys
    const keys = await r.lrange("locations:recent", 0, 5);
    if (!keys?.length) return [];

    // Fetch full metadata for each key in parallel
    const results = await Promise.all(
      keys.map(async (cacheKey) => {
        try {
          const raw = await r.get(`loc:${cacheKey}`);
          if (!raw) return null;
          const loc = typeof raw === "string" ? JSON.parse(raw) : raw;
          return {
            displayName: loc.displayName,
            city: loc.city,
            state: loc.state,
            country: loc.country,
            cacheKey: loc.cacheKey,
          };
        } catch {
          return null;
        }
      })
    );

    return results.filter(Boolean);
  } catch (e) {
    console.warn("getRecentLocations failed:", e.message);
    return [];
  }
}

export async function getLocationCount() {
  const r = getRedis();
  if (!r) return 0;
  try {
    return await r.scard("locations:all");
  } catch {
    return 0;
  }
}
