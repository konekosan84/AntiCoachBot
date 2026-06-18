import axios from "axios";

const API_URL = "http://localhost:4000/api/v1/rooms";

export async function getRooms() {
  const res = await axios.get(API_URL);
  return res.data;
}

export async function createRoom(data) {
  const res = await axios.post(API_URL, data);
  return res.data;
}

export async function updateRoom(id, data) {
  const res = await axios.put(`${API_URL}/${id}`, data);
  return res.data;
}

export async function deleteRoom(id) {
  const res = await axios.delete(`${API_URL}/${id}`);
  return res.data;
}

/** many-to-many room ↔ branches */
export async function updateRoomBranches(id, branchIds) {
  const res = await axios.put(`${API_URL}/${id}/branches`, {
    branch_ids: branchIds,
  });
  return res.data;
}
