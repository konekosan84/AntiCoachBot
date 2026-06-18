import { apiFetch as request } from "./apiFetch.js";

const BASE = "/api/v1/dashboard";

export async function getDirectorDashboard(params = {}) {
  const search = new URLSearchParams();

  if (params.from) search.set("from", params.from);
  if (params.to) search.set("to", params.to);
  if (params.branch_id) search.set("branch_id", String(params.branch_id));

  const qs = search.toString();
  const result = await request(qs ? `${BASE}/director?${qs}` : `${BASE}/director`);
  return result?.data || null;
}

export async function getPlatformDashboard() {
  const result = await request(`${BASE}/platform`);
  return result?.data || null;
}

export async function getBusinessDashboard(businessId) {
  const result = await request(`${BASE}/business/${businessId}`);
  return result?.data || null;
}

export async function getBranchDashboard(branchId) {
  const result = await request(`${BASE}/branch/${branchId}`);
  return result?.data || null;
}

export async function getEmployeeDashboard(employeeId) {
  const result = await request(`${BASE}/employee/${employeeId}`);
  return result?.data || null;
}
