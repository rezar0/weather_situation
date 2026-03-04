// src/cache.js
// Upstash Redis caching layer.
// Cache keys and TTLs:
//   geo:{query}           → geocoded location        TTL: 7 days
//   current:{cacheKey}    → current + forecast       TTL: 30 min
//   thisyear:{cacheKey}   → this year daily data     TTL: 6 hours
//   climate:{cacheKey}    → 30yr normals             TTL: 30 days
//   locations             → set of all searched locs TTL: permanent

import { Redis } from "@upstash/redis";

let redis = null;

function getRedis() {
  if (!redis) {
    if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
      return null; // gracefully skip caching if not configured
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

// Record every unique location searched so we can build our own dataset
export async function recordLocation(location) {
  const r = getRedis();
  if (!r) return;
  try {
    const key = `loc:${location.cacheKey}`;
    await r.set(key, JSON.stringify({
      ...location,
      lastSearched: new Date().toISOString(),
    }));
    await r.sadd("locations:all", location.cacheKey);
  } catch (e) {
    console.warn("recordLocation failed:", e.message);
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
