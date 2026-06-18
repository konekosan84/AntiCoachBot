import { apiFetch } from "./apiFetch.js";

const fetchJson = apiFetch;
const API_BASE = "/api/v1";

export function getShifts({ date_from, date_to, branch_id = "all", employee_id = "all" }) {
  const p = new URLSearchParams();
  p.set("date_from", date_from);
  p.set("date_to", date_to);
  if (branch_id && branch_id !== "all") p.set("branch_id", String(branch_id));
  if (employee_id && employee_id !== "all") p.set("employee_id", String(employee_id));
  return fetchJson(`${API_BASE}/schedule/shifts?${p.toString()}`);
}

// payload: single { date, branch_id, employee_id, start_time, end_time, notes }
//   or series { branch_id, employee_id, start_time, end_time, notes,
//               repeat: { weekdays:[0..6], date_from, date_to } }
export function createShift(payload) {
  return fetchJson(`${API_BASE}/schedule/shifts`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateShift(id, payload) {
  return fetchJson(`${API_BASE}/schedule/shifts/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

// scope: 'future' | 'all' — update across the whole series
export function updateShiftScope(id, scope, payload) {
  return fetchJson(`${API_BASE}/schedule/shifts/${id}/scope?scope=${scope}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

// scope: 'one' | 'future' | 'all'
export function deleteShift(id, scope = "one") {
  return fetchJson(`${API_BASE}/schedule/shifts/${id}?scope=${scope}`, { method: "DELETE" });
}

export function getShiftSeries(id) {
  return fetchJson(`${API_BASE}/schedule/shifts/${id}/series`);
}
