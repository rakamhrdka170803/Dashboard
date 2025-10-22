import api from "./client";

// POST multipart/form-data
export async function createLeaveRequest({ type="CUTI", start_date, end_date, reason, file }) {
  const fd = new FormData();
  fd.append("type", type);
  fd.append("start_date", start_date);
  fd.append("end_date", end_date);
  if (reason) fd.append("reason", reason);
  if (file) fd.append("file", file);
  const { data } = await api.post("/leave-requests", fd);
  return data;
}

export async function listLeaveRequests({ status, requester_id, page=1, size=50 } = {}) {
  const params = new URLSearchParams();
  if (status) params.set("status", status);
  if (requester_id) params.set("requester_id", requester_id);
  params.set("page", page); params.set("size", size);
  const { data } = await api.get(`/leave-requests?${params.toString()}`);
  return data;
}

export async function approveLeaveRequest(id) {
  const { data } = await api.patch(`/leave-requests/${id}/approve`, {});
  return data;
}

export async function rejectLeaveRequest(id, reason) {
  const { data } = await api.patch(`/leave-requests/${id}/reject`, { reason });
  return data;
}

// ✅ Cancel (hapus) pengajuan sendiri saat masih PENDING
export async function cancelLeaveRequest(id) {
  const { data } = await api.delete(`/leave-requests/${id}`);
  return data;
}
