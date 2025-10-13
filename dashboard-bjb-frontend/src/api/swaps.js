import api from "./client";

export async function createSwap({ start_at, reason }) {
  const { data } = await api.post("/swaps", { start_at, reason });
  return data;
}
export async function listSwaps({ page = 1, size = 10 } = {}) {
  const { data } = await api.get(`/swaps?page=${page}&size=${size}`);
  return data;
}
export async function acceptSwap({ swapId, counterparty_schedule_id }) {
  const { data } = await api.patch(`/swaps/${swapId}/accept`, { counterparty_schedule_id });
  return data;
}
export async function cancelSwap({ swapId }) {
  const { data } = await api.patch(`/swaps/${swapId}/cancel`);
  return data;
}
