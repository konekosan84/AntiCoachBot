import axios from "axios";

const API_URL = "http://localhost:4000/api/v1/services";

/* ---------- GET ---------- */
export async function getServices() {
  const res = await axios.get(API_URL);
  return res.data;
}

/* ---------- CREATE ---------- */
export async function createService(data) {
  const res = await axios.post(API_URL, data);
  return res.data;
}

/* ---------- UPDATE ---------- */
export async function updateService(id, data) {
  const res = await axios.put(`${API_URL}/${id}`, data);
  return res.data;
}

/* ---------- DELETE ---------- */
export async function deleteService(id) {
  const res = await axios.delete(`${API_URL}/${id}`);
  return res.data;
}
