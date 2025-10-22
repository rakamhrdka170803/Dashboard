import api from "./client";

export async function listMonthly({ month, userId } = {}) {
  const params = new URLSearchParams();
  if (month) params.set("month", month);
  if (userId) params.set("user_id", userId);
  const { data } = await api.get(`/schedules/monthly?${params.toString()}`);
  return data;
}

// semua jadwal sebulan, tanpa batasan role
export async function listMonthlyAll({ month } = {}) {
  const params = new URLSearchParams();
  if (month) params.set("month", month);
  const { data } = await api.get(`/schedules/monthly-all?${params.toString()}`);
  return Array.isArray(data) ? { month, items: data } : data;
}

export async function createSchedule(payload) {
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

export const getOffDays = (userId, month) =>
  api.get(`/users/${userId}/off-days`, { params: { month } }).then(r => r.data);