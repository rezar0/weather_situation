// src/useWeather.js
import { useState, useCallback } from "react";
import { API_BASE } from "./config.js";

export function useWeather() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetch_ = useCallback(async (query) => {
    if (!query.trim()) return;
    setLoading(true);
    setError(null);
    setData(null);
    try {
      const res = await fetch(`${API_BASE}/weather?q=${encodeURIComponent(query)}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Something went wrong");
      setData(json);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const reset = () => { setData(null); setError(null); setLoading(false); };
  return { data, loading, error, fetch: fetch_, reset };
}
