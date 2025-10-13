import api from "./client";

export async function listMonthly({ month, userId } = {}) {
  const params = new URLSearchParams();
  if (month) params.set("month", month); // "2025-10"
  if (userId) params.set("user_id", userId);
  const { data } = await api.get(`/schedules/monthly?${params.toString()}`);
  return data; // { month, items: [...] }
}

export async function createSchedule(payload) {
  // payload: { user_id, start_at, end_at, channel, shift_name?, notes? }
  const { data } = await api.post("/schedules", payload);
  return data;
}

export async function updateSchedule(id, payload) {
  const { data } = await api.put(`/schedules/${id}`, payload);
  return data;
}

export async function deleteSchedule(id) {
  const { data } = await api.delete(`/schedules/${id}`);
  return data;
}
