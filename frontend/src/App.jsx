import { useState } from "react";
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine,
} from "recharts";
import { useWeather } from "./useWeather.js";
import { wmoEmoji } from "./wmo.js";

// ─── THEME ────────────────────────────────────────────────────────────────────
const T = {
  bg: "#080810", surface: "#10101c", card: "#16162a", border: "#242438",
  accent: "#f7c948", warm: "#ff6b35", cool: "#4fc3f7", green: "#69db7c",
  nerd: "#b47cff", text: "#f0f0f8", muted: "#8888aa", dim: "#44445a",
};

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

// ─── SMALL COMPONENTS ────────────────────────────────────────────────────────

const Tip = ({ active, payload, label, unit = "°F" }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 10, padding: "10px 14px", fontSize: 13 }}>
      <div style={{ color: T.muted, fontFamily: "serif", fontSize: 11, marginBottom: 4, letterSpacing: 1 }}>{label}</div>
      {payload.map((p, i) => p.value != null && (
        <div key={i} style={{ color: p.color || T.accent, fontWeight: 600 }}>
          {p.name}: {typeof p.value === "number" ? p.value.toFixed(1) : p.value}{unit}
        </div>
      ))}
    </div>
  );
};

const Toggle = ({ options, value, onChange }) => (
  <div style={{ display: "flex", background: T.surface, borderRadius: 8, padding: 3, gap: 2, border: `1px solid ${T.border}` }}>
    {options.map(o => (
      <button key={o.v} onClick={() => onChange(o.v)} style={{
        padding: "5px 14px", borderRadius: 6, border: "none", cursor: "pointer",
        fontSize: 12, fontWeight: 600, transition: "all 0.15s",
        background: value === o.v ? T.accent : "transparent",
        color: value === o.v ? "#0a0a0f" : T.muted,
        fontFamily: "inherit",
      }}>{o.l}</button>
    ))}
  </div>
);

const StatCard = ({ label, value, sub, color, nerdy, showNerdy }) => (
  <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 14, padding: "18px 20px" }}
    onMouseEnter={e => e.currentTarget.style.borderColor = color || T.accent}
    onMouseLeave={e => e.currentTarget.style.borderColor = T.border}>
    <div style={{ fontSize: 10, color: T.muted, letterSpacing: 1.5, textTransform: "uppercase", fontFamily: "'Playfair Display', serif", marginBottom: 8 }}>{label}</div>
    <div style={{ fontSize: 30, fontWeight: 900, color: color || T.text, fontFamily: "'Playfair Display', serif", lineHeight: 1 }}>{value}</div>
    {sub && <div style={{ fontSize: 12, color: T.muted, marginTop: 4 }}>{sub}</div>}
    {showNerdy && nerdy && (
      <div style={{ marginTop: 8, fontSize: 11, color: T.nerd, background: "#b47cff12", borderRadius: 6, padding: "4px 8px", fontFamily: "'DM Mono', monospace" }}>{nerdy}</div>
    )}
  </div>
);

const PctBar = ({ value, label, color }) => (
  <div style={{ marginBottom: 12 }}>
    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
      <span style={{ fontSize: 12, color: T.muted }}>{label}</span>
      <span style={{ fontSize: 12, color, fontWeight: 700 }}>{value}th %ile</span>
    </div>
    <div style={{ height: 6, background: T.border, borderRadius: 3, overflow: "hidden" }}>
      <div style={{ height: "100%", width: `${value}%`, background: `linear-gradient(90deg, ${color}66, ${color})`, borderRadius: 3, transition: "width 1s" }} />
    </div>
  </div>
);

// ─── LOADING SCREEN ──────────────────────────────────────────────────────────
function LoadingScreen({ query }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100vh", gap: 20 }}>
      <div style={{ fontSize: 48, animation: "spin 2s linear infinite" }}>🌦️</div>
      <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, color: T.muted }}>
        Checking {query}…
      </div>
      <div style={{ fontSize: 13, color: T.dim }}>Pulling 30 years of data</div>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// ─── LANDING PAGE ─────────────────────────────────────────────────────────────
function Landing({ onSearch }) {
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);

  const go = () => query.trim() && onSearch(query);

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 40, position: "relative", overflow: "hidden" }}>
      {/* Huge ghost text */}
      <div style={{ position: "absolute", fontSize: "clamp(60px,16vw,180px)", fontFamily: "'Playfair Display', serif", fontWeight: 900, color: "#ffffff03", pointerEvents: "none", userSelect: "none", letterSpacing: -8, top: "50%", left: "50%", transform: "translate(-50%, -50%)", whiteSpace: "nowrap" }}>NORMAL?</div>

      <div style={{ textAlign: "center", maxWidth: 580, position: "relative", zIndex: 1 }}>
        <div style={{ fontSize: 11, letterSpacing: 4, color: T.accent, textTransform: "uppercase", fontFamily: "'Playfair Display', serif", marginBottom: 18 }}>
          a weather context tool
        </div>
        <h1 style={{ fontSize: "clamp(40px,7vw,80px)", fontFamily: "'Playfair Display', serif", fontWeight: 900, lineHeight: 1.05, letterSpacing: -2, margin: "0 0 14px" }}>
          Is this weather<br />
          <em style={{ color: T.accent }}>normal?</em>
        </h1>
        <p style={{ color: T.muted, fontSize: 17, marginBottom: 40, lineHeight: 1.65 }}>
          Enter your location to find out if today's weather<br />is weird, historic, or perfectly average.
        </p>

        <div style={{ display: "flex", gap: 10, maxWidth: 460, margin: "0 auto 24px" }}>
          <input value={query} onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === "Enter" && go()}
            onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
            placeholder="City, zip code, or address…"
            style={{ flex: 1, padding: "15px 18px", borderRadius: 12, border: `2px solid ${focused ? T.accent : T.border}`, background: T.surface, color: T.text, fontSize: 16, outline: "none", fontFamily: "inherit", transition: "border-color 0.2s" }} />
          <button onClick={go} style={{ padding: "15px 26px", borderRadius: 12, border: "none", background: T.accent, color: "#08080f", fontSize: 15, fontWeight: 700, cursor: "pointer", fontFamily: "'Playfair Display', serif", letterSpacing: 0.3 }}>
            Check it →
          </button>
        </div>

        <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
          {["Austin, TX", "Portland, OR", "Miami, FL", "Chicago, IL", "94103"].map(ex => (
            <button key={ex} onClick={() => onSearch(ex)} style={{ background: "none", border: `1px solid ${T.border}`, color: T.muted, padding: "6px 14px", borderRadius: 20, fontSize: 12, cursor: "pointer", fontFamily: "inherit", transition: "all 0.15s" }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = T.accent; e.currentTarget.style.color = T.accent; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.color = T.muted; }}>
              {ex}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── DASHBOARD ────────────────────────────────────────────────────────────────
function Dashboard({ data, onSearch, nerdMode, setNerdMode }) {
  const [tab, setTab] = useState("overview");
  const [trendView, setTrendView] = useState("month");
  const [searchQ, setSearchQ] = useState("");

  const { location, current, forecast, thisYear, thisYearMonthly, monthlyNormals,
    annualAnomalies, thisWeekHistory, weekRecord, anomalyCalendar, stats } = data;

  const anomalyColor = !stats.tempAnomaly ? T.muted : stats.tempAnomaly > 0 ? T.warm : T.cool;

  // Build combined monthly chart data
  const monthlyChartData = MONTHS.map((m, i) => ({
    month: m,
    thisYear: thisYearMonthly[i]?.avgMean,
    normal: monthlyNormals[i]?.normalMean,
    precip: thisYearMonthly[i]?.totalPrecip,
    normalPrecip: monthlyNormals[i]?.normalPrecip,
    uv: thisYear.filter(d => parseInt(d.date.split("-")[1]) - 1 === i).reduce((a, b, _, arr) => a + (b.uv || 0) / arr.length, 0) || null,
  }));

  const trendData = trendView === "month" ? monthlyChartData
    : trendView === "week"
      ? (() => {
          // Aggregate by week
          const weeks = {};
          for (const d of thisYear) {
            const date = new Date(d.date);
            const week = Math.ceil(date.getDate() / 7) + (date.getMonth() * 5);
            const key = `W${String(week).padStart(2, "0")}`;
            if (!weeks[key]) weeks[key] = { temps: [], normals: [] };
            if (d.mean != null) weeks[key].temps.push(d.mean);
          }
          return Object.entries(weeks).slice(0, 52).map(([week, v]) => ({
            week,
            thisYear: v.temps.length ? Math.round(v.temps.reduce((a, b) => a + b) / v.temps.length) : null,
          }));
        })()
      : annualAnomalies.map(a => ({ year: String(a.year), anomaly: a.anomaly }));

  return (
    <div>
      {/* TOP BAR */}
      <div style={{ borderBottom: `1px solid ${T.border}`, padding: "12px 28px", display: "flex", alignItems: "center", justifyContent: "space-between", background: `${T.bg}ee`, backdropFilter: "blur(10px)", position: "sticky", top: 0, zIndex: 100, flexWrap: "wrap", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <span style={{ fontFamily: "'Playfair Display', serif", fontWeight: 900, fontSize: 17, color: T.accent, fontStyle: "italic" }}>normal?</span>
          <div style={{ display: "flex", gap: 8 }}>
            <input value={searchQ} onChange={e => setSearchQ(e.target.value)}
              onKeyDown={e => e.key === "Enter" && searchQ.trim() && onSearch(searchQ)}
              placeholder="Search another location…"
              style={{ padding: "6px 13px", borderRadius: 8, border: `1px solid ${T.border}`, background: T.surface, color: T.text, fontSize: 13, outline: "none", width: 220, fontFamily: "inherit" }} />
            <button onClick={() => searchQ.trim() && onSearch(searchQ)} style={{ padding: "6px 13px", borderRadius: 8, border: "none", background: T.accent, color: "#08080f", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>→</button>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button onClick={() => setNerdMode(!nerdMode)} style={{ padding: "6px 14px", borderRadius: 8, cursor: "pointer", border: `1px solid ${nerdMode ? T.nerd : T.border}`, background: nerdMode ? "#b47cff18" : "transparent", color: nerdMode ? T.nerd : T.muted, fontSize: 12, fontWeight: 600, fontFamily: "inherit", transition: "all 0.2s" }}>
            🔬 Nerd stats {nerdMode ? "ON" : "off"}
          </button>
          <div style={{ color: T.muted, fontSize: 12 }}>{location.displayName}</div>
        </div>
      </div>

      {/* VERDICT BANNER */}
      <div style={{ background: `linear-gradient(135deg, ${anomalyColor}1a, ${T.surface})`, borderBottom: `1px solid ${anomalyColor}30`, padding: "28px 28px 24px" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 20 }}>
            <div>
              <div style={{ fontSize: 10, letterSpacing: 3, color: anomalyColor, textTransform: "uppercase", fontFamily: "'Playfair Display', serif", marginBottom: 6 }}>
                Today's verdict — {location.displayName}
              </div>
              <div style={{ fontSize: "clamp(26px,5vw,52px)", fontFamily: "'Playfair Display', serif", fontWeight: 900, lineHeight: 1.1, letterSpacing: -1 }}>
                {stats.summary}
                {stats.tempAnomaly != null && (
                  <span style={{ color: anomalyColor }}> ({stats.tempAnomaly > 0 ? "+" : ""}{stats.tempAnomaly}°F)</span>
                )}
              </div>
              <div style={{ color: T.muted, fontSize: 14, marginTop: 6 }}>
                {current.temp}°F feels like {current.feelsLike}°F · {current.condition}
                {stats.todayNormal && ` · Normal for today: ${stats.todayNormal}°F`}
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 70, fontFamily: "'Playfair Display', serif", fontWeight: 900, lineHeight: 1, color: anomalyColor }}>{current.temp}°</div>
              <div style={{ fontSize: 13, color: T.muted }}>H:{forecast[0]?.high}° L:{forecast[0]?.low}°</div>
            </div>
          </div>
          <div style={{ marginTop: 18, maxWidth: 460 }}>
            <PctBar value={stats.tempPercentile} label="Warmer than this % of historical days" color={anomalyColor} />
            <PctBar value={current.humidity > 70 ? 75 : current.humidity > 50 ? 55 : 30} label="More humid than this % of historical days" color={T.cool} />
          </div>
        </div>
      </div>

      {/* TABS */}
      <div style={{ borderBottom: `1px solid ${T.border}`, padding: "0 28px", display: "flex", gap: 0, overflowX: "auto" }}>
        {[["overview","Overview"],["trends","Trends"],["precipitation","Precipitation"],["history","This Week in History"],["anomaly","Anomaly Map"]].map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)} style={{ padding: "13px 18px", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 13, fontWeight: 600, color: tab === id ? T.accent : T.muted, borderBottom: `2px solid ${tab === id ? T.accent : "transparent"}`, whiteSpace: "nowrap", marginBottom: -1, transition: "color 0.15s" }}>
            {label}
          </button>
        ))}
      </div>

      {/* CONTENT */}
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "26px 28px 60px" }}>

        {/* ── OVERVIEW ── */}
        {tab === "overview" && (
          <div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(155px,1fr))", gap: 13, marginBottom: 28 }}>
              <StatCard label="Temperature" value={`${current.temp}°F`} sub={stats.todayNormal ? `Normal: ${stats.todayNormal}°F` : "—"} color={anomalyColor} showNerdy={nerdMode} nerdy={`Anomaly: ${stats.tempAnomaly > 0 ? "+" : ""}${stats.tempAnomaly}°F vs 30yr avg`} />
              <StatCard label="Humidity" value={`${current.humidity}%`} sub={current.humidity > 70 ? "Humid" : current.humidity > 40 ? "Comfortable" : "Dry"} color={T.cool} showNerdy={nerdMode} nerdy={`Feels like ${current.feelsLike}°F (apparent temp)`} />
              <StatCard label="UV Index" value={current.uvIndex} sub={current.uvIndex >= 8 ? "Very High — SPF!" : current.uvIndex >= 6 ? "High — wear SPF" : current.uvIndex >= 3 ? "Moderate" : "Low"} color={current.uvIndex >= 6 ? T.warm : T.green} showNerdy={nerdMode} nerdy="Peak UV window: 10am–2pm" />
              <StatCard label="Wind" value={`${current.wind} mph`} sub={current.wind > 25 ? "Windy" : current.wind > 15 ? "Breezy" : "Calm"} showNerdy={nerdMode} nerdy={`Wind speed at 10m above ground`} />
              <StatCard label="Today High" value={`${forecast[0]?.high ?? "—"}°F`} sub={monthlyNormals[new Date().getMonth()] ? `Normal: ~${monthlyNormals[new Date().getMonth()].normalHigh}°F` : ""} color={T.warm} showNerdy={nerdMode} nerdy={`ERA5 30yr monthly high avg`} />
              <StatCard label="Rain Chance" value={`${forecast[0]?.precipProb ?? 0}%`} sub={forecast[0]?.precipProb > 60 ? "Likely rain" : forecast[0]?.precipProb > 30 ? "Possible rain" : "Unlikely"} color={T.cool} showNerdy={nerdMode} nerdy={`NWP ensemble probability`} />
            </div>

            {/* 7-day forecast */}
            <div style={{ marginBottom: 28 }}>
              <div style={{ fontSize: 10, color: T.muted, letterSpacing: 2, textTransform: "uppercase", fontFamily: "'Playfair Display', serif", marginBottom: 13 }}>7-Day Forecast</div>
              <div style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 4 }}>
                {forecast.map((d, i) => {
                  const dayLabel = i === 0 ? "Today" : new Date(d.date + "T12:00:00").toLocaleDateString("en-US", { weekday: "short" });
                  return (
                    <div key={i} style={{ flex: "0 0 auto", minWidth: 88, background: i === 0 ? `${T.accent}14` : T.card, border: `1px solid ${i === 0 ? T.accent : T.border}`, borderRadius: 12, padding: "14px 10px", textAlign: "center" }}>
                      <div style={{ fontSize: 10, color: T.muted, letterSpacing: 1, marginBottom: 6 }}>{dayLabel}</div>
                      <div style={{ fontSize: 24 }}>{wmoEmoji(d.weatherCode)}</div>
                      <div style={{ fontSize: 15, fontWeight: 700, margin: "6px 0 2px" }}>{d.high}°</div>
                      <div style={{ fontSize: 12, color: T.muted }}>{d.low}°</div>
                      {nerdMode && <div style={{ fontSize: 10, color: T.nerd, marginTop: 4, fontFamily: "'DM Mono', monospace" }}>{d.precipProb}%</div>}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Quick temp chart */}
            <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 16, padding: 22 }}>
              <div style={{ fontSize: 10, color: T.muted, letterSpacing: 2, textTransform: "uppercase", fontFamily: "'Playfair Display', serif", marginBottom: 18 }}>Temperature vs. 30-Year Normal (Monthly)</div>
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={monthlyChartData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="ga" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={T.warm} stopOpacity={0.28} />
                      <stop offset="95%" stopColor={T.warm} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={T.border} vertical={false} />
                  <XAxis dataKey="month" tick={{ fill: T.muted, fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: T.muted, fontSize: 11 }} axisLine={false} tickLine={false} unit="°" />
                  <Tooltip content={<Tip />} />
                  <Area type="monotone" dataKey="thisYear" name="This year" stroke={T.warm} fill="url(#ga)" strokeWidth={2.5} dot={false} connectNulls />
                  <Area type="monotone" dataKey="normal" name="30yr normal" stroke={T.accent} fill="none" strokeWidth={1.5} strokeDasharray="4 4" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
              <div style={{ display: "flex", gap: 18, marginTop: 10 }}>
                {[[T.warm,"This year"],[T.accent,"30yr normal",true]].map(([c,l,dash]) => (
                  <div key={l} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: T.muted }}>
                    <div style={{ width: 20, height: 2, background: c, borderStyle: dash ? "dashed" : "solid", borderColor: c, borderWidth: 1 }} />{l}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── TRENDS ── */}
        {tab === "trends" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 10 }}>
              <div style={{ fontSize: 10, color: T.muted, letterSpacing: 2, textTransform: "uppercase", fontFamily: "'Playfair Display', serif" }}>Temperature Trends</div>
              <Toggle options={[{v:"month",l:"Monthly"},{v:"week",l:"Weekly"},{v:"year",l:"Yearly anomaly"}]} value={trendView} onChange={setTrendView} />
            </div>
            <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 16, padding: 22, marginBottom: 18 }}>
              <ResponsiveContainer width="100%" height={300}>
                {trendView === "year" ? (
                  <BarChart data={trendData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={T.border} vertical={false} />
                    <XAxis dataKey="year" tick={{ fill: T.muted, fontSize: 10 }} axisLine={false} tickLine={false} interval={4} />
                    <YAxis tick={{ fill: T.muted, fontSize: 11 }} axisLine={false} tickLine={false} unit="°" />
                    <Tooltip content={<Tip />} />
                    <ReferenceLine y={0} stroke={T.dim} strokeWidth={2} />
                    <Bar dataKey="anomaly" name="Anomaly" radius={[3,3,0,0]} fill={T.warm} />
                  </BarChart>
                ) : (
                  <AreaChart data={trendData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="gt" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={T.warm} stopOpacity={0.22} />
                        <stop offset="95%" stopColor={T.warm} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke={T.border} vertical={false} />
                    <XAxis dataKey={trendView === "month" ? "month" : "week"} tick={{ fill: T.muted, fontSize: 10 }} axisLine={false} tickLine={false} interval={trendView === "week" ? 3 : 0} />
                    <YAxis tick={{ fill: T.muted, fontSize: 11 }} axisLine={false} tickLine={false} unit="°" />
                    <Tooltip content={<Tip />} />
                    <Area type="monotone" dataKey={trendView === "month" ? "thisYear" : "thisYear"} name="This year" stroke={T.warm} fill="url(#gt)" strokeWidth={2.5} dot={false} connectNulls />
                    {trendView === "month" && <Area type="monotone" dataKey="normal" name="30yr normal" stroke={T.accent} fill="none" strokeWidth={1.5} strokeDasharray="4 4" dot={false} />}
                  </AreaChart>
                )}
              </ResponsiveContainer>
            </div>
            {trendView === "year" && (
              <div style={{ fontSize: 12, color: T.muted, paddingLeft: 4 }}>
                Annual mean temperature anomaly vs. 30-year baseline ({annualAnomalies[0]?.year}–{annualAnomalies[annualAnomalies.length - 1]?.year}).
                {nerdMode && <span style={{ color: T.nerd }}> Positive = warmer. Computed from ERA5-Land reanalysis at ~9km resolution.</span>}
              </div>
            )}
          </div>
        )}

        {/* ── PRECIPITATION ── */}
        {tab === "precipitation" && (
          <div>
            <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 16, padding: 22, marginBottom: 18 }}>
              <div style={{ fontSize: 10, color: T.muted, letterSpacing: 2, textTransform: "uppercase", fontFamily: "'Playfair Display', serif", marginBottom: 18 }}>Monthly Precipitation — This Year vs. Normal</div>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={monthlyChartData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={T.border} vertical={false} />
                  <XAxis dataKey="month" tick={{ fill: T.muted, fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: T.muted, fontSize: 11 }} axisLine={false} tickLine={false} unit="in" />
                  <Tooltip content={<Tip unit="in" />} />
                  <Bar dataKey="precip" name="This year" fill={T.cool} radius={[4,4,0,0]} />
                  <Bar dataKey="normalPrecip" name="30yr normal" fill={`${T.accent}55`} radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 13 }}>
              {(() => {
                const ytdPrecip = thisYearMonthly.reduce((a, m) => a + (m.totalPrecip || 0), 0);
                const ytdNormal = monthlyNormals.slice(0, new Date().getMonth() + 1).reduce((a, m) => a + (m.normalPrecip || 0), 0);
                const pct = ytdNormal ? Math.round((ytdPrecip / ytdNormal - 1) * 100) : 0;
                return [
                  <StatCard key="ytd" label="YTD Precipitation" value={`${ytdPrecip.toFixed(1)} in`} sub={`Normal: ${ytdNormal.toFixed(1)} in (${pct > 0 ? "+" : ""}${pct}%)`} color={T.cool} showNerdy={nerdMode} nerdy="Accumulated from ERA5 daily precip sums" />,
                  <StatCard key="wet" label="Wettest Month" value={(() => { const m = thisYearMonthly.reduce((a, b) => (b.totalPrecip || 0) > (a.totalPrecip || 0) ? b : a); return `${MONTHS[m.month]} (${m.totalPrecip?.toFixed(1)} in)`; })()} sub="Most rain this year" color={T.cool} showNerdy={nerdMode} />,
                  <StatCard key="dry" label="Driest Month" value={(() => { const m = thisYearMonthly.filter(m => m.totalPrecip != null).reduce((a, b) => (b.totalPrecip || 99) < (a.totalPrecip || 99) ? b : a); return `${MONTHS[m.month]} (${m.totalPrecip?.toFixed(1)} in)`; })()} sub="Least rain this year" showNerdy={nerdMode} />,
                ];
              })()}
            </div>
          </div>
        )}

        {/* ── THIS WEEK IN HISTORY ── */}
        {tab === "history" && (
          <div>
            <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 16, padding: 22, marginBottom: 18 }}>
              <div style={{ fontSize: 10, color: T.muted, letterSpacing: 2, textTransform: "uppercase", fontFamily: "'Playfair Display', serif", marginBottom: 6 }}>Average Temperature This Week — {thisWeekHistory[0]?.year}–{thisWeekHistory[thisWeekHistory.length - 1]?.year}</div>
              <div style={{ fontSize: 13, color: T.muted, marginBottom: 18 }}>How does this year's week compare historically?</div>
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={thisWeekHistory} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gh" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={T.cool} stopOpacity={0.18} />
                      <stop offset="95%" stopColor={T.cool} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={T.border} vertical={false} />
                  <XAxis dataKey="year" tick={{ fill: T.muted, fontSize: 10 }} axisLine={false} tickLine={false} interval={4} />
                  <YAxis tick={{ fill: T.muted, fontSize: 11 }} axisLine={false} tickLine={false} unit="°" />
                  <Tooltip content={<Tip />} />
                  <ReferenceLine y={weekRecord?.avg} stroke={T.accent} strokeDasharray="4 4" label={{ value: "avg", fill: T.accent, fontSize: 10 }} />
                  <Area type="monotone" dataKey="avgTemp" name="Avg temp" stroke={T.cool} fill="url(#gh)" strokeWidth={2} dot={{ r: 2.5, fill: T.cool }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))", gap: 13 }}>
              <StatCard label="Record High (this week)" value={`${weekRecord?.high}°F`} sub={`Year: ${weekRecord?.highYear}`} color={T.warm} showNerdy={nerdMode} nerdy="ERA5 reanalysis max" />
              <StatCard label="Record Low (this week)" value={`${weekRecord?.low}°F`} sub={`Year: ${weekRecord?.lowYear}`} color={T.cool} showNerdy={nerdMode} nerdy="ERA5 reanalysis min" />
              <StatCard label="Historical Average" value={`${weekRecord?.avg}°F`} sub="This week across 30 years" showNerdy={nerdMode} nerdy="30yr mean for this week-of-year" />
              <StatCard label="This Year (est.)" value={`${current.temp}°F`} sub={stats.tempAnomaly != null ? `${stats.tempAnomaly > 0 ? "+" : ""}${stats.tempAnomaly}°F vs avg` : "vs avg"} color={anomalyColor} showNerdy={nerdMode} nerdy="Current observed temperature" />
            </div>
          </div>
        )}

        {/* ── ANOMALY CALENDAR ── */}
        {tab === "anomaly" && (
          <div>
            <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 16, padding: 22 }}>
              <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 10, marginBottom: 18 }}>
                <div>
                  <div style={{ fontSize: 10, color: T.muted, letterSpacing: 2, textTransform: "uppercase", fontFamily: "'Playfair Display', serif", marginBottom: 4 }}>Temperature Anomaly Heatmap — {new Date().getFullYear()}</div>
                  <div style={{ fontSize: 12, color: T.dim }}>Each cell = one day · 🔴 above normal · 🔵 below normal</div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: T.muted }}>
                  <div style={{ width: 40, height: 8, borderRadius: 4, background: `linear-gradient(90deg, ${T.cool}, ${T.border}, ${T.warm})` }} />
                  <span>−8° → 0 → +8°</span>
                </div>
              </div>

              {/* Calendar grid */}
              <div style={{ overflowX: "auto" }}>
                <div style={{ display: "flex", gap: 3, marginBottom: 5, paddingLeft: 28 }}>
                  {MONTHS.map(m => <div key={m} style={{ flex: 1, minWidth: 20, textAlign: "center", fontSize: 9, color: T.muted }}>{m}</div>)}
                </div>
                {Array.from({ length: 31 }, (_, day) => (
                  <div key={day} style={{ display: "flex", gap: 3, marginBottom: 2, alignItems: "center" }}>
                    <div style={{ width: 26, fontSize: 9, color: T.dim, textAlign: "right", paddingRight: 3 }}>
                      {(day + 1) % 5 === 1 ? day + 1 : ""}
                    </div>
                    {MONTHS.map((_, mi) => {
                      const dateStr = `${new Date().getFullYear()}-${String(mi + 1).padStart(2, "0")}-${String(day + 1).padStart(2, "0")}`;
                      const cell = anomalyCalendar.find(c => c.date === dateStr);
                      if (!cell || cell.anomaly == null) return <div key={mi} style={{ flex: 1, minWidth: 20, height: 13, borderRadius: 2, background: T.surface }} />;
                      const a = cell.anomaly;
                      const hot = a > 0;
                      const intensity = Math.min(1, Math.abs(a) / 8);
                      const bg = hot ? `rgba(255,107,53,${0.08 + intensity * 0.72})` : `rgba(79,195,247,${0.08 + intensity * 0.72})`;
                      return <div key={mi} style={{ flex: 1, minWidth: 20, height: 13, borderRadius: 2, background: bg, cursor: "default" }} title={`${dateStr}: ${a > 0 ? "+" : ""}${a}°F`} />;
                    })}
                  </div>
                ))}
              </div>

              {nerdMode && (
                <div style={{ marginTop: 18, padding: "12px 16px", background: "#b47cff0e", borderRadius: 10, border: `1px solid ${T.nerd}22` }}>
                  <div style={{ fontSize: 11, color: T.nerd, fontWeight: 700, marginBottom: 4 }}>🔬 Methodology</div>
                  <div style={{ fontSize: 12, color: T.muted, lineHeight: 1.65, fontFamily: "'DM Mono', monospace" }}>
                    Anomalies = daily mean temp (ERA5-Land) minus 30yr climatological baseline (same calendar day, 1994–{new Date().getFullYear() - 1}). Spatial resolution: ~9km. 5-day lag for ERA5 reanalysis updates.
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* FOOTER */}
      <div style={{ borderTop: `1px solid ${T.border}`, padding: "18px 28px", display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
        <div style={{ fontSize: 11, color: T.dim, fontStyle: "italic" }}>Data: Open-Meteo · ERA5-Land · Nominatim · Updated hourly</div>
        <div style={{ fontSize: 11, color: T.dim }}>is this weather normal? · {location.displayName}</div>
      </div>
    </div>
  );
}

// ─── ROOT APP ─────────────────────────────────────────────────────────────────
export default function App() {
  const { data, loading, error, fetch } = useWeather();
  const [lastQuery, setLastQuery] = useState("");
  const [nerdMode, setNerdMode] = useState(false);

  const handleSearch = (q) => {
    setLastQuery(q);
    fetch(q);
  };

  return (
    <div style={{ minHeight: "100vh", background: T.bg, color: T.text, fontFamily: "'DM Sans', sans-serif" }}>
      {/* Subtle grain */}
      <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0, opacity: 0.3, backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.05'/%3E%3C/svg%3E\")" }} />

      <div style={{ position: "relative", zIndex: 1 }}>
        {loading && <LoadingScreen query={lastQuery} />}
        {!loading && error && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100vh", gap: 14 }}>
            <div style={{ fontSize: 40 }}>⚠️</div>
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, color: T.warm }}>Couldn't find that location</div>
            <div style={{ color: T.muted, fontSize: 14 }}>{error}</div>
            <button onClick={() => window.location.reload()} style={{ marginTop: 10, padding: "10px 22px", background: T.accent, color: "#08080f", border: "none", borderRadius: 8, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Try again</button>
          </div>
        )}
        {!loading && !error && !data && <Landing onSearch={handleSearch} />}
        {!loading && !error && data && <Dashboard data={data} onSearch={handleSearch} nerdMode={nerdMode} setNerdMode={setNerdMode} />}
      </div>
    </div>
  );
}
