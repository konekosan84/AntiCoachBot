/**
 * Single fetch helper for all /api/v1/* calls.
 * Auto-injects Authorization (JWT) and x-tenant-id (from cached user).
 * On 401, drops session and redirects to /login.
 */
export async function apiFetch(url, options = {}) {
  const token   = localStorage.getItem("slotiq-token");
  let userRaw = null;
  try { userRaw = JSON.parse(localStorage.getItem("slotiq-user") || "null"); } catch {}

  const headers = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(userRaw?.business_id ? { "x-tenant-id": String(userRaw.business_id) } : { "x-tenant-id": "1" }),
    ...(options.headers || {}),
  };

  const res = await fetch(url, { ...options, headers });

  if (res.status === 401) {
    localStorage.removeItem("slotiq-token");
    localStorage.removeItem("slotiq-user");
    if (!location.pathname.startsWith("/login")) location.href = "/login";
  }

  let data = null;
  try { data = await res.json(); } catch { data = null; }

  if (!res.ok) {
    const err = new Error(data?.error || `HTTP_${res.status}`);
    err.status = res.status;
    err.payload = data;
    throw err;
  }
  return data;
}
