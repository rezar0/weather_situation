// src/weather.js
// All Open-Meteo API calls. Completely free, no API key.
//
// APIs used:
//   /v1/forecast        → current conditions + 7-day forecast
//   /v1/archive         → ERA5 historical data (1940-present, ~5 day lag)
//
// We make 3-4 parallel fetches then process into a single unified payload.

const FORECAST_BASE = "https://api.open-meteo.com/v1/forecast";
const ARCHIVE_BASE = "https://archive-api.open-meteo.com/v1/archive";

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function toF(c) {
  return Math.round((c * 9) / 5 + 32);
}
function mmToIn(mm) {
  return Math.round((mm / 25.4) * 100) / 100;
}

function dateStr(d) {
  return d.toISOString().split("T")[0];
}

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

function yearsAgo(n) {
  const d = new Date();
  d.setFullYear(d.getFullYear() - n);
  return d;
}

async function fetchJSON(url) {
  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Open-Meteo error ${res.status}: ${body}`);
  }
  return res.json();
}

// ─── WMO WEATHER CODE → LABEL ────────────────────────────────────────────────

const WMO = {
  0: "Clear Sky", 1: "Mainly Clear", 2: "Partly Cloudy", 3: "Overcast",
  45: "Foggy", 48: "Icy Fog",
  51: "Light Drizzle", 53: "Drizzle", 55: "Heavy Drizzle",
  61: "Light Rain", 63: "Rain", 65: "Heavy Rain",
  71: "Light Snow", 73: "Snow", 75: "Heavy Snow",
  77: "Snow Grains", 80: "Light Showers", 81: "Showers", 82: "Heavy Showers",
  85: "Snow Showers", 86: "Heavy Snow Showers",
  95: "Thunderstorm", 96: "Thunderstorm w/ Hail", 99: "Severe Thunderstorm",
};

// ─── CURRENT + FORECAST ───────────────────────────────────────────────────────

export async function fetchCurrentAndForecast(lat, lon) {
  const params = new URLSearchParams({
    latitude: lat,
    longitude: lon,
    current: [
      "temperature_2m", "apparent_temperature", "relative_humidity_2m",
      "precipitation", "weather_code", "wind_speed_10m",
      "uv_index", "is_day",
    ].join(","),
    daily: [
      "temperature_2m_max", "temperature_2m_min",
      "precipitation_sum", "precipitation_probability_max",
      "weather_code", "uv_index_max", "sunrise", "sunset",
    ].join(","),
    temperature_unit: "fahrenheit",
    wind_speed_unit: "mph",
    precipitation_unit: "inch",
    timezone: "auto",
    forecast_days: 7,
  });

  const data = await fetchJSON(`${FORECAST_BASE}?${params}`);
  const c = data.current;
  const d = data.daily;

  const current = {
    temp: Math.round(c.temperature_2m),
    feelsLike: Math.round(c.apparent_temperature),
    humidity: Math.round(c.relative_humidity_2m),
    precip: c.precipitation,
    condition: WMO[c.weather_code] || "Unknown",
    weatherCode: c.weather_code,
    wind: Math.round(c.wind_speed_10m),
    uvIndex: Math.round(c.uv_index ?? 0),
    isDay: c.is_day === 1,
  };

  const forecast = d.time.map((date, i) => ({
    date,
    high: Math.round(d.temperature_2m_max[i]),
    low: Math.round(d.temperature_2m_min[i]),
    precipSum: d.precipitation_sum[i],
    precipProb: d.precipitation_probability_max[i],
    weatherCode: d.weather_code[i],
    condition: WMO[d.weather_code[i]] || "Unknown",
    uvMax: d.uv_index_max[i],
    sunrise: d.sunrise[i],
    sunset: d.sunset[i],
  }));

  return { current, forecast };
}

// ─── HISTORICAL: CURRENT YEAR ─────────────────────────────────────────────────
// Fetches daily data for the current year so far (for trend charts).

export async function fetchThisYear(lat, lon) {
  const start = `${new Date().getFullYear()}-01-01`;
  const end = dateStr(daysAgo(6)); // ERA5 has ~5 day lag

  const params = new URLSearchParams({
    latitude: lat,
    longitude: lon,
    daily: [
      "temperature_2m_max", "temperature_2m_min", "temperature_2m_mean",
      "precipitation_sum", "uv_index_max",
    ].join(","),
    temperature_unit: "fahrenheit",
    precipitation_unit: "inch",
    timezone: "auto",
    start_date: start,
    end_date: end,
  });

  const data = await fetchJSON(`${ARCHIVE_BASE}?${params}`);
  const d = data.daily;

  return d.time.map((date, i) => ({
    date,
    high: Math.round(d.temperature_2m_max[i]),
    low: Math.round(d.temperature_2m_min[i]),
    mean: d.temperature_2m_mean[i] != null ? Math.round(d.temperature_2m_mean[i]) : null,
    precip: d.precipitation_sum[i] ?? 0,
    uv: d.uv_index_max[i] ?? null,
  }));
}

// ─── HISTORICAL CLIMATE NORMALS ───────────────────────────────────────────────
// Fetches 30 years of daily data and computes:
//   - Monthly normals (avg high, avg low, avg precip)
//   - "This week" history (last 40 years, same week)
//   - Annual anomaly (per-year mean vs 30yr baseline)
//   - Daily anomaly calendar for the current year

export async function fetchClimatology(lat, lon) {
  // 30 years of history for normals (ERA5)
  const endYear = new Date().getFullYear() - 1; // last full year
  const startYear = endYear - 29; // 30 years

  const params = new URLSearchParams({
    latitude: lat,
    longitude: lon,
    daily: [
      "temperature_2m_max", "temperature_2m_min", "temperature_2m_mean",
      "precipitation_sum",
    ].join(","),
    temperature_unit: "fahrenheit",
    precipitation_unit: "inch",
    timezone: "auto",
    start_date: `${startYear}-01-01`,
    end_date: `${endYear}-12-31`,
  });

  const data = await fetchJSON(`${ARCHIVE_BASE}?${params}`);
  const d = data.daily;

  // Index daily observations
  const byDate = {};
  for (let i = 0; i < d.time.length; i++) {
    byDate[d.time[i]] = {
      high: d.temperature_2m_max[i],
      low: d.temperature_2m_min[i],
      mean: d.temperature_2m_mean[i],
      precip: d.precipitation_sum[i] ?? 0,
    };
  }

  // ── Monthly normals ──
  const monthlyAccum = Array.from({ length: 12 }, () => ({
    highs: [], lows: [], means: [], precips: [],
  }));
  for (const [date, v] of Object.entries(byDate)) {
    const month = parseInt(date.split("-")[1]) - 1;
    if (v.high != null) monthlyAccum[month].highs.push(v.high);
    if (v.low != null) monthlyAccum[month].lows.push(v.low);
    if (v.mean != null) monthlyAccum[month].means.push(v.mean);
    if (v.precip != null) monthlyAccum[month].precips.push(v.precip);
  }
  const avg = (arr) => arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : null;
  const sum = (arr) => arr.reduce((a, b) => a + b, 0);

  const monthlyNormals = monthlyAccum.map((m, i) => ({
    month: i,
    normalHigh: avg(m.highs),
    normalLow: avg(m.lows),
    normalMean: avg(m.means),
    // Average monthly total precip = avg daily * days in month
    normalPrecip: Math.round(sum(m.precips) / 30 * 10) / 10,
  }));

  // ── Annual anomalies ──
  // Overall 30yr baseline mean
  const allMeans = Object.values(byDate).map((v) => v.mean).filter(Boolean);
  const baseline = allMeans.reduce((a, b) => a + b, 0) / allMeans.length;

  const annualAccum = {};
  for (const [date, v] of Object.entries(byDate)) {
    const year = date.split("-")[0];
    if (!annualAccum[year]) annualAccum[year] = [];
    if (v.mean != null) annualAccum[year].push(v.mean);
  }
  const annualAnomalies = Object.entries(annualAccum)
    .map(([year, temps]) => ({
      year: parseInt(year),
      anomaly: Math.round((temps.reduce((a, b) => a + b, 0) / temps.length - baseline) * 10) / 10,
    }))
    .sort((a, b) => a.year - b.year);

  // ── "This week" history ──
  const today = new Date();
  const weekOfYear = Math.ceil(
    ((today - new Date(today.getFullYear(), 0, 1)) / 86400000 + 1) / 7
  );

  const thisWeekHistory = [];
  for (let yr = startYear; yr <= endYear; yr++) {
    // Get all dates in the same week of that year
    const weekTemps = [];
    for (let doy = (weekOfYear - 1) * 7; doy < weekOfYear * 7; doy++) {
      const d2 = new Date(yr, 0, 1 + doy);
      const key = dateStr(d2);
      if (byDate[key]?.mean != null) weekTemps.push(byDate[key].mean);
    }
    if (weekTemps.length) {
      thisWeekHistory.push({
        year: yr,
        avgTemp: Math.round(weekTemps.reduce((a, b) => a + b, 0) / weekTemps.length),
      });
    }
  }

  // Compute records for this week
  const weekTemps = thisWeekHistory.map((w) => w.avgTemp);
  const weekRecord = {
    high: Math.max(...weekTemps),
    highYear: thisWeekHistory.find((w) => w.avgTemp === Math.max(...weekTemps))?.year,
    low: Math.min(...weekTemps),
    lowYear: thisWeekHistory.find((w) => w.avgTemp === Math.min(...weekTemps))?.year,
    avg: Math.round(weekTemps.reduce((a, b) => a + b, 0) / weekTemps.length),
  };

  // ── Daily normals for anomaly calendar ──
  // (day-of-year averages over 30 years)
  const doyAccum = {};
  for (const [date, v] of Object.entries(byDate)) {
    const [, mm, dd] = date.split("-");
    const key = `${mm}-${dd}`;
    if (!doyAccum[key]) doyAccum[key] = [];
    if (v.mean != null) doyAccum[key].push(v.mean);
  }
  const dailyNormals = {};
  for (const [key, temps] of Object.entries(doyAccum)) {
    dailyNormals[key] = Math.round(temps.reduce((a, b) => a + b, 0) / temps.length);
  }

  return {
    monthlyNormals,
    annualAnomalies,
    thisWeekHistory,
    weekRecord,
    dailyNormals,
    baseline: Math.round(baseline),
  };
}

// ─── ANOMALY CALENDAR ─────────────────────────────────────────────────────────
// Given this year's daily data and daily normals, compute per-day anomalies.

export function computeAnomalyCalendar(thisYearData, dailyNormals) {
  return thisYearData.map((d) => {
    const [, mm, dd] = d.date.split("-");
    const key = `${mm}-${dd}`;
    const normal = dailyNormals[key];
    return {
      date: d.date,
      mean: d.mean,
      normal: normal ?? null,
      anomaly: normal != null && d.mean != null ? Math.round((d.mean - normal) * 10) / 10 : null,
    };
  });
}

// ─── PERCENTILE RANK ──────────────────────────────────────────────────────────
// Where does today's temp rank among all historical same-day values?

export function computePercentile(currentTemp, dailyNormals, thisWeekHistory) {
  // Use this week's historical distribution
  const temps = thisWeekHistory.map((w) => w.avgTemp).sort((a, b) => a - b);
  if (!temps.length) return 50;
  const below = temps.filter((t) => t <= currentTemp).length;
  return Math.round((below / temps.length) * 100);
}
