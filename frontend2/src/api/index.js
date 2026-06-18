import axios from "axios";

const api = axios.create({
  baseURL: "http://localhost:4000/api",
});

// ---------------------- BRANCHES ----------------------
export async function getBranches() {
  const { data } = await api.get("/branches");
  return data;
}

export async function createBranch(form) {
  const { data } = await api.post("/branches", form);
  return data;
}

export async function updateBranch(id, form) {
  const { data } = await api.put(`/branches/${id}`, form);
  return data;
}

export async function deleteBranch(id) {
  const { data } = await api.delete(`/branches/${id}`);
  return data;
}

// ---------------------- EMPLOYEES ----------------------
export async function getEmployees() {
  const { data } = await api.get("/employees");
  return data;
}

// ---------------------- SERVICES ----------------------
export async function getServices() {
  const { data } = await api.get("/services");
  return data;
}

// ---------------------- ROOMS ----------------------
export async function getRooms() {
  const { data } = await api.get("/rooms");
  return data;
}

export default {
  getBranches,
  createBranch,
  updateBranch,
  deleteBranch,
  getEmployees,
  getServices,
  getRooms,
};

