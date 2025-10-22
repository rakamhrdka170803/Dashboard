import api from "./client";

export const listHolidaySwaps = ({ page=1, size=50 } = {}) =>
  api.get("/holiday-swaps", { params: { page, size } }).then(r => r.data);

export const createHolidaySwap = (payload) =>
  api.post("/holiday-swaps", payload).then(r => r.data);

export const acceptHolidaySwap = (id) =>
  api.post(`/holiday-swaps/${id}/accept`).then(r => r.data);

export const rejectHolidaySwap = (id) =>
  api.post(`/holiday-swaps/${id}/reject`).then(r => r.data);

export const cancelHolidaySwap = (id) =>
  api.post(`/holiday-swaps/${id}/cancel`).then(r => r.data);

// BO approve: start_time (HH:mm) → end auto +8 jam di backend
export const boApproveHolidaySwap = (id, { start_time, channel, shift_name, notes }) =>
  api.post(`/holiday-swaps/${id}/bo-approve`, {
    start_time,
    channel,
    shift_name,
    notes,
  }).then(r => r.data);
