// src/api/swaps.js
import api from "./client";

/**
 * Kirim payload apa adanya supaya field opsional (target_user_id) tidak hilang.
 * Contoh payload yang dikirim dari FE:
 * {
 *   start_at: "2025-10-07T02:00:00.000Z",
 *   reason: "alasan",
 *   target_user_id: 8            // ← opsional, kirim hanya jika ada
 * }
 */
export async function createSwap(payload) {
  const { data } = await api.post("/swaps", payload);
  return data;
}

export async function listSwaps({ page = 1, size = 100 } = {}) {
  const params = new URLSearchParams({ page, size });
  const { data } = await api.get(`/swaps?${params.toString()}`);
  return data; // items sudah mengandung channel/target_user_id/dll dari BE
}

export async function acceptSwap({ swapId, counterparty_schedule_id }) {
  // sesuaikan dengan route kamu; kalau di server pakai POST, ganti ke post
  const { data } = await api.post(`/swaps/${swapId}/accept`, { counterparty_schedule_id });
  return data;
}

export async function cancelSwap({ swapId }) {
  // sesuaikan dengan route kamu; kalau di server pakai POST, ganti ke post
  const { data } = await api.post(`/swaps/${swapId}/cancel`);
  return data;
}
