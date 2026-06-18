import axios from "axios";

const API_URL = "http://localhost:4000/api/v1/employees";

/* ---------- GET ---------- */
export async function getEmployees() {
  const res = await axios.get(API_URL);
  return res.data;
}

/* ---------- CREATE ---------- */
export async function createEmployee(data) {
  const res = await axios.post(API_URL, data);
  return res.data;
}

/* ---------- UPDATE ---------- */
export async function updateEmployee(id, data) {
  const res = await axios.put(`${API_URL}/${id}`, data);
  return res.data;
}

/* ---------- DELETE ---------- */
export async function deleteEmployee(id) {
  const res = await axios.delete(`${API_URL}/${id}`);
  return res.data;
}

/* ---------- UPDATE EMPLOYEE BRANCHES ---------- */
export async function updateEmployeeBranches(employeeId, branchIds) {
  const res = await axios.put(
    `${API_URL}/${employeeId}/branches`,
    { branchIds }
  );
  return res.data;
}
