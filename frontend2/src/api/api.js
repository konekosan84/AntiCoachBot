import axios from "axios";

/* ── Global axios interceptors — apply to ALL axios calls,
   not just the `api` instance below. ────────────────────── */
axios.interceptors.request.use((config) => {
  try {
    const token = localStorage.getItem("slotiq-token");
    if (token) config.headers.Authorization = `Bearer ${token}`;
    const userRaw = localStorage.getItem("slotiq-user");
    if (userRaw) {
      const u = JSON.parse(userRaw);
      if (u?.business_id && !config.headers["x-tenant-id"]) {
        config.headers["x-tenant-id"] = String(u.business_id);
      }
    }
  } catch {}
  return config;
});

axios.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err?.response?.status === 401) {
      localStorage.removeItem("slotiq-token");
      localStorage.removeItem("slotiq-user");
      if (!location.pathname.startsWith("/login")) {
        location.href = "/login";
      }
    }
    return Promise.reject(err);
  }
);

const api = axios.create({ baseURL: "http://localhost:4000/api/v1" });

export default api;
