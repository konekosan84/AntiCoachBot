/**
 * Public widget API calls — no auth required.
 * Used by BookingFlow (/booking page).
 */
const BASE =
  import.meta.env.VITE_API_URL ||
  import.meta.env.VITE_API_BASE ||
  "http://localhost:4000";

const W = `${BASE}/api/v1/widget`;

async function get(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP_${res.status}`);
  return res.json();
}

export const getWidgetBranches  = () => get(`${W}/branches`);
export const getWidgetServices  = () => get(`${W}/services`);
export const getWidgetEmployees = () => get(`${W}/employees`);

export const getWidgetShifts = (dateFrom, dateTo) =>
  get(`${W}/shifts?date_from=${dateFrom}&date_to=${dateTo}`);

export const getWidgetBookings = (dateFrom, dateTo) =>
  get(`${W}/bookings?date_from=${dateFrom}&date_to=${dateTo}`);

export async function createWidgetBooking(payload) {
  const res = await fetch(`${W}/bookings`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const err = new Error(data?.error || `HTTP_${res.status}`);
    err.status = res.status;
    err.payload = data;
    throw err;
  }
  return data;
}
