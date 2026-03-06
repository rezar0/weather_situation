// Single source of truth for the API base URL.
// VITE_API_URL must be set as an environment variable in your Railway
// frontend service — it gets baked in at build time by Vite.
//
// Example: VITE_API_URL=https://your-backend.up.railway.app

export const API_BASE = import.meta.env.VITE_API_URL || "";

if (!import.meta.env.VITE_API_URL) {
  console.warn(
    "[config] VITE_API_URL is not set. API calls will be relative to the current origin, which will fail in production. Set VITE_API_URL in your Railway frontend service variables."
  );
}
