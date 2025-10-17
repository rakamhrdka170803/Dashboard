import api from "./client";

export async function listMyNotifications({ unread = false, limit = 50 } = {}) {
  const params = new URLSearchParams();
  if (unread) params.set("unread", "true");
  if (limit) params.set("limit", String(limit));
  const { data } = await api.get(`/notifications?${params.toString()}`);
  // pastikan handler BE return array items, kalau sekarang langsung array → sesuaikan:
  return Array.isArray(data) ? data : (data.items || []);
}

export async function markRead(id) {
  const { data } = await api.patch(`/notifications/${id}/read`);
  return data;
}
