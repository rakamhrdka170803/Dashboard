import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "/api/v1",
  timeout: 15000,
});

// attach latest token every request
api.interceptors.request.use((cfg) => {
  const token = sessionStorage.getItem("token") || localStorage.getItem("token");
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  return cfg;
});

// optional: on 401, cleanup token (biar ga stuck) — nanti UI akan redirect via ProtectedRoute
api.interceptors.response.use(
  r => r,
  err => {
    if (err?.response?.status === 401) {
      sessionStorage.removeItem("token"); sessionStorage.removeItem("user");
      localStorage.removeItem("token"); localStorage.removeItem("user");
    }
    return Promise.reject(err);
  }
);

export function fileUrl(path = "") {
  if (!path) return "";
  // Jika path sudah absolute (http/https), langsung return
  if (/^https?:\/\//i.test(path)) return path;

  // Ambil origin API dari env (mis. http://localhost:8080)
  // Kalau tidak ada, fallback: ambil origin dari baseURL bila absolute
  const origin =
    import.meta.env.VITE_API_ORIGIN ||
    (() => {
      try {
        const u = new URL(api.defaults.baseURL, window.location.origin);
        return `${u.protocol}//${u.host}`;
      } catch {
        return window.location.origin; // fallback terpaksa
      }
    })();

  // Pastikan path diawali slash
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${origin}${p}`;
}

export default api;
