// src/index.js
import express from "express";
import cors from "cors";
import { geocode } from "./geocode.js";
import {
  fetchCurrentAndForecast,
  fetchThisYear,
  fetchClimatology,
  computeAnomalyCalendar,
  computePercentile,
} from "./weather.js";
import {
  cacheGetParsed,
  cacheSet,
  recordLocation,
  getLocationCount,
  getRecentLocations,
} from "./cache.js";

const app = express();
const PORT = process.env.PORT || 8080;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`✅ Weather API running on port ${PORT}`);
  console.log(
    `   Redis: ${
      process.env.UPSTASH_REDIS_REST_URL
        ? "connected"
        : "not configured (caching disabled)"
    }`
  );
});

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (curl, Postman, server-to-server)
    if (!origin) return callback(null, true);
    // Allow any Railway subdomain, localhost, and the production domain
    const allowed = [
      /\.railway\.app$/,
      /^http:\/\/localhost/,
    ];
    if (allowed.some(r => r.test(origin))) return callback(null, true);
    callback(new Error("CORS: origin not allowed: " + origin));
  },
  methods: ["GET"],
}));
app.use(express.json());

// ─── HEALTH CHECK ─────────────────────────────────────────────────────────────
app.get("/health", (req, res) => {
  res.status(200).send("ok");
});

// ─── RECENT LOCATIONS ────────────────────────────────────────────────────────
app.get("/recent", async (req, res) => {
  try {
    const locations = await getRecentLocations();
    res.json({ locations });
  } catch (err) {
    res.json({ locations: [] });
  }
});

// ─── MAIN WEATHER ENDPOINT ────────────────────────────────────────────────────
// GET /weather?q=Austin%2C+TX
// Returns a fully computed payload ready for the frontend.
//
// Response shape:
// {
//   location: { city, state, country, lat, lon, displayName },
//   current: { temp, feelsLike, humidity, uvIndex, ... },
//   forecast: [ { date, high, low, condition, precipProb, ... } x7 ],
//   thisYear: [ { date, high, low, mean, precip } ],
//   monthlyNormals: [ { month, normalHigh, normalLow, normalMean, normalPrecip } x12 ],
//   annualAnomalies: [ { year, anomaly } x30 ],
//   thisWeekHistory: [ { year, avgTemp } x30 ],
//   weekRecord: { high, highYear, low, lowYear, avg },
//   anomalyCalendar: [ { date, mean, normal, anomaly } ],
//   stats: { tempPercentile, tempAnomaly, summary }
// }

app.get("/weather", async (req, res) => {
  const query = req.query.q?.trim();
  if (!query) return res.status(400).json({ error: "Missing ?q= parameter" });

  try {
    // ── 1. Geocode ──────────────────────────────────────────────────────────
    const geoKey = `geo:${query.toLowerCase()}`;
    let location = await cacheGetParsed(geoKey);
    if (!location) {
      location = await geocode(query);
      await cacheSet(geoKey, location, 7 * 24 * 3600); // 7 days
    }
    const { lat, lon, cacheKey } = location;

    // recordLocation is called after successful response below

    // ── 2. Current + Forecast (30min cache) ────────────────────────────────
    const currentKey = `current:${cacheKey}`;
    let currentData = await cacheGetParsed(currentKey);
    if (!currentData) {
      currentData = await fetchCurrentAndForecast(lat, lon);
      await cacheSet(currentKey, currentData, 30 * 60); // 30 min
    }

    // ── 3. This Year daily data (6hr cache) ────────────────────────────────
    const thisYearKey = `thisyear:${cacheKey}`;
    let thisYearData = await cacheGetParsed(thisYearKey);
    if (!thisYearData) {
      thisYearData = await fetchThisYear(lat, lon);
      await cacheSet(thisYearKey, thisYearData, 6 * 3600); // 6 hours
    }

    // ── 4. Climatology / 30yr normals (30 day cache — rarely changes) ─────
    const climateKey = `climate:${cacheKey}`;
    let climate = await cacheGetParsed(climateKey);
    if (!climate) {
      climate = await fetchClimatology(lat, lon);
      await cacheSet(climateKey, climate, 30 * 24 * 3600); // 30 days
    }

    // ── 5. Compute derived stats ───────────────────────────────────────────
    const anomalyCalendar = computeAnomalyCalendar(thisYearData, climate.dailyNormals);

    const tempPercentile = computePercentile(
      currentData.current.temp,
      climate.dailyNormals,
      climate.thisWeekHistory
    );

    // Today's anomaly vs daily normal
    const today = new Date().toISOString().split("T")[0];
    const [, mm, dd] = today.split("-");
    const todayNormal = climate.dailyNormals[`${mm}-${dd}`];
    const tempAnomaly = todayNormal != null
      ? Math.round((currentData.current.temp - todayNormal) * 10) / 10
      : null;

    const summary = buildSummary(tempAnomaly, tempPercentile);

    // Augment monthly normals with this year's monthly data
    const thisYearMonthly = aggregateMonthly(thisYearData);

    res.json({
      location: {
        city: location.city,
        state: location.state,
        country: location.country,
        lat,
        lon,
        displayName: location.displayName,
      },
      current: currentData.current,
      forecast: currentData.forecast,
      thisYear: thisYearData,
      thisYearMonthly,
      monthlyNormals: climate.monthlyNormals,
      annualAnomalies: climate.annualAnomalies,
      thisWeekHistory: climate.thisWeekHistory,
      weekRecord: climate.weekRecord,
      anomalyCalendar,
      stats: {
        tempPercentile,
        tempAnomaly,
        todayNormal,
        summary,
        baseline: climate.baseline,
      },
    });

    // Record AFTER successful response — only real successful lookups go in recents
    recordLocation(location);
  } catch (err) {
    console.error("Weather endpoint error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ─── HELPERS ──────────────────────────────────────────────────────────────────

function buildSummary(anomaly, percentile) {
  if (anomaly == null) return "About normal";
  if (anomaly > 10) return "Exceptionally hot";
  if (anomaly > 5) return "Much warmer than usual";
  if (anomaly > 2) return "Warmer than usual";
  if (anomaly > -2) return "About normal";
  if (anomaly > -5) return "Cooler than usual";
  if (anomaly > -10) return "Much cooler than usual";
  return "Exceptionally cold";
}

function aggregateMonthly(dailyData) {
  const months = Array.from({ length: 12 }, () => ({
    highs: [], lows: [], means: [], precips: [],
  }));
  for (const d of dailyData) {
    const m = parseInt(d.date.split("-")[1]) - 1;
    if (d.high != null) months[m].highs.push(d.high);
    if (d.low != null) months[m].lows.push(d.low);
    if (d.mean != null) months[m].means.push(d.mean);
    if (d.precip != null) months[m].precips.push(d.precip);
  }
  const avg = (arr) => arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : null;
  const sum = (arr) => Math.round(arr.reduce((a, b) => a + b, 0) * 10) / 10;
  return months.map((m, i) => ({
    month: i,
    avgHigh: avg(m.highs),
    avgLow: avg(m.lows),
    avgMean: avg(m.means),
    totalPrecip: m.precips.length ? sum(m.precips) : null,
  }));
}

// ─── START ────────────────────────────────────────────────────────────────────
app.listen(PORT, "0.0.0.0", () => {
  console.log(`✅ Weather API running on port ${PORT}`);
  console.log(`   Redis: ${process.env.UPSTASH_REDIS_REST_URL ? "connected" : "not configured (caching disabled)"}`);
});
