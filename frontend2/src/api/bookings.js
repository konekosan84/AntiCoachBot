import { apiFetch } from "./apiFetch.js";

const BASE =
  import.meta.env.VITE_API_URL ||
  import.meta.env.VITE_API_BASE ||
  "http://localhost:4000";

const fetchJson = apiFetch;

// ❗ КРИТИЧНО: никакого Date(), только строка
function ensureISO(dateStr, name) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(dateStr || ""))) {
    throw new Error(`${name} must be YYYY-MM-DD`);
  }
  return dateStr;
}

function ensureTime(timeStr, name) {
  if (!/^\d{2}:\d{2}$/.test(String(timeStr || ""))) {
    throw new Error(`${name} must be HH:mm`);
  }
  return timeStr;
}

export async function getBookings(params = {}) {
  const qs = new URLSearchParams();

  if (params.branch_id && params.branch_id !== "all") {
    qs.set("branch_id", String(params.branch_id));
  }

  if (params.employee_id && params.employee_id !== "all") {
    qs.set("employee_id", String(params.employee_id));
  }

  if (params.service_id && params.service_id !== "all") {
    qs.set("service_id", String(params.service_id));
  }

  if (params.status && params.status !== "all") {
    qs.set("status", String(params.status));
  }

  if (params.search) {
    qs.set("search", String(params.search).trim());
  }

  if (params.date_from) {
    qs.set("date_from", ensureISO(params.date_from, "date_from"));
  }

  if (params.date_to) {
    qs.set("date_to", ensureISO(params.date_to, "date_to"));
  }

  const result = await fetchJson(`${BASE}/api/v1/bookings?${qs.toString()}`);
  return result?.data || [];
}

export async function getBookingById(id) {
  const result = await fetchJson(`${BASE}/api/v1/bookings/${id}`);
  return result?.data || null;
}

// ✅ СОЗДАНИЕ — БЕЗ ЛЮБЫХ ПРЕОБРАЗОВАНИЙ ДАТЫ
export async function createBooking(payload) {
  const safePayload = {
    ...payload,
    date: ensureISO(payload.date, "date"),
    start_time: ensureTime(payload.start_time, "start_time"),
  };

  const result = await fetchJson(`${BASE}/api/v1/bookings`, {
    method: "POST",
    body: JSON.stringify(safePayload),
  });

  return result?.data || null;
}

// ✅ ОБНОВЛЕНИЕ — ТО ЖЕ САМОЕ
export async function updateBooking(id, payload) {
  const safePayload = {
    ...payload,
    date: ensureISO(payload.date, "date"),
    start_time: ensureTime(payload.start_time, "start_time"),
  };

  const result = await fetchJson(`${BASE}/api/v1/bookings/${id}`, {
    method: "PUT",
    body: JSON.stringify(safePayload),
  });

  return result?.data || null;
}

export async function updateBookingStatus(id, status) {
  const result = await fetchJson(`${BASE}/api/v1/bookings/${id}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
  return result?.data || null;
}

// ✅ ДОСТУПНЫЕ СОТРУДНИКИ — ТОЖЕ БЕЗ DATE()
export async function getAvailableEmployees({
  branch_id,
  date,
  service_id,
  start_time,
  exclude_booking_id,
}) {
  const qs = new URLSearchParams();

  if (!branch_id) throw new Error("branch_id is required");
  if (!service_id) throw new Error("service_id is required");
  if (!date) throw new Error("date is required");
  if (!start_time) throw new Error("start_time is required");

  qs.set("branch_id", String(branch_id));
  qs.set("service_id", String(service_id));
  qs.set("date", ensureISO(date, "date"));
  qs.set("start_time", ensureTime(start_time, "start_time"));

  if (exclude_booking_id) {
    qs.set("exclude_booking_id", String(exclude_booking_id));
  }

  const result = await fetchJson(
    `${BASE}/api/v1/bookings/available-employees?${qs.toString()}`
  );

  return {
    data: result?.data || [],
    meta: result?.meta || null,
  };
}