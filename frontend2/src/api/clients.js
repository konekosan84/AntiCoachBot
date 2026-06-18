import { apiFetch as request } from "./apiFetch.js";

const BASE = "/api/v1/clients";

export async function getClients(params = {}) {
  const search = new URLSearchParams();

  if (params.search) search.set("search", params.search);
  if (params.status) search.set("status", params.status);
  if (params.branch_mode) search.set("branch_mode", params.branch_mode);
  if (params.branch_id) search.set("branch_id", String(params.branch_id));
  if (params.limit) search.set("limit", String(params.limit));
  if (params.offset) search.set("offset", String(params.offset));

  const qs = search.toString();
  const result = await request(qs ? `${BASE}?${qs}` : BASE);
  return result?.data || [];
}

export async function getClient(id) {
  return request(`${BASE}/${id}`);
}

export async function createClient(payload) {
  return request(BASE, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateClient(id, payload) {
  return request(`${BASE}/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function deleteClient(id) {
  return request(`${BASE}/${id}`, {
    method: "DELETE",
  });
}