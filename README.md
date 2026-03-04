# Is This Weather Normal?

A weather context app that answers "is this actually weird?" for any location, using 30 years of ERA5 reanalysis data.

---

## Architecture

```
frontend/ (React + Vite)          backend/ (Express on Railway)
     │                                   │
     │  GET /weather?q=Austin TX         │
     └──────────────────────────────────►│
                                         │── Nominatim geocode
                                         │── Open-Meteo forecast
                                         │── Open-Meteo ERA5 archive (30yr)
                                         │── Upstash Redis cache
                                         │◄─ unified JSON payload
     ◄──────────────────────────────────┘
```

**APIs used (all free, no key required):**
- [Open-Meteo Forecast API](https://open-meteo.com/en/docs) — current + 7-day forecast
- [Open-Meteo Historical API](https://archive-api.open-meteo.com) — ERA5 data back to 1940
- [Nominatim / OpenStreetMap](https://nominatim.org) — geocoding

**Storage:**
- [Upstash Redis](https://upstash.com) — caching + location database

---

## Cache TTLs

| Data | Key pattern | TTL |
|------|-------------|-----|
| Geocoded location | `geo:{query}` | 7 days |
| Current + forecast | `current:{lat,lon}` | 30 min |
| This year daily | `thisyear:{lat,lon}` | 6 hours |
| 30yr climatology | `climate:{lat,lon}` | 30 days |
| Location registry | `loc:{lat,lon}` | permanent |

The first search for a location takes ~3-5s (3 API calls). Every repeat visit is instant.

---

## Setup

### 1. Clone & install

```bash
git clone <your-repo>

cd backend && npm install
cd ../frontend && npm install
```

### 2. Create Upstash Redis

1. Go to [console.upstash.com](https://console.upstash.com)
2. Create a new Redis database (Regional, US East works well)
3. Copy `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`

### 3. Run locally

```bash
# Backend
cd backend
UPSTASH_REDIS_REST_URL=https://xxx.upstash.io \
UPSTASH_REDIS_REST_TOKEN=xxx \
npm run dev
# → running on http://localhost:3001

# Frontend (separate terminal)
cd frontend
npm run dev
# → running on http://localhost:5173
```

Test the backend directly:
```bash
curl "http://localhost:3001/weather?q=Austin,TX" | jq .location
curl "http://localhost:3001/health"
```

---

## Deploy to Railway

### Backend

1. Go to [railway.app](https://railway.app) → New Project → Deploy from GitHub
2. Select the `backend/` folder (or point to it in Railway settings)
3. Add environment variables:
   ```
   UPSTASH_REDIS_REST_URL=https://xxx.upstash.io
   UPSTASH_REDIS_REST_TOKEN=xxx
   PORT=3001
   ```
4. Railway auto-detects the `Dockerfile` and deploys
5. Copy your Railway public URL (e.g. `https://weather-api-production.up.railway.app`)

### Frontend

Option A — Vercel (recommended):
1. `cd frontend && npm run build`
2. Deploy `dist/` to Vercel
3. Set env var: `VITE_API_URL=https://your-railway-url.railway.app`

Option B — Railway static:
1. Add a second Railway service for the frontend
2. Set build command: `npm run build`
3. Set start command: `npx serve dist`

---

## API Response Shape

```json
{
  "location": { "city", "state", "country", "lat", "lon", "displayName" },
  "current": { "temp", "feelsLike", "humidity", "uvIndex", "condition", "wind" },
  "forecast": [ { "date", "high", "low", "condition", "precipProb", "uvMax" } ],
  "thisYear": [ { "date", "high", "low", "mean", "precip", "uv" } ],
  "thisYearMonthly": [ { "month", "avgHigh", "avgLow", "avgMean", "totalPrecip" } ],
  "monthlyNormals": [ { "month", "normalHigh", "normalLow", "normalMean", "normalPrecip" } ],
  "annualAnomalies": [ { "year", "anomaly" } ],
  "thisWeekHistory": [ { "year", "avgTemp" } ],
  "weekRecord": { "high", "highYear", "low", "lowYear", "avg" },
  "anomalyCalendar": [ { "date", "mean", "normal", "anomaly" } ],
  "stats": { "tempPercentile", "tempAnomaly", "todayNormal", "summary", "baseline" }
}
```

---

## Growing Location Database

Every unique search is recorded to Redis:
- `loc:{lat,lon}` → location metadata + timestamp
- `locations:all` → Redis set of all cache keys

Check total locations searched:
```bash
curl https://your-api.railway.app/health
# → { "status": "ok", "locationsInDb": 247 }
```

---

## Notes

- ERA5 has a ~5 day lag. Recent days fall back to forecast data.
- Nominatim rate limit: 1 req/sec. Geocode results are cached 7 days so this is fine.
- Open-Meteo free tier: 10,000 req/day. With Redis caching this supports thousands of users.
- The 30yr climatology fetch (the slow one) makes 1 large ERA5 call covering 30 years. It's cached 30 days per location.
