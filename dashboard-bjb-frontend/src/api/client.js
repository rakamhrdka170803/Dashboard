import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "/api/v1",
  timeout: 15000,
});

// Prioritas sessionStorage (per-tab), fallback localStorage (kalau Remember me)
api.interceptors.request.use((cfg) => {
  const token = sessionStorage.getItem("token") || localStorage.getItem("token");
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  return cfg;
});

export default api;
