import api from "./client";

/**
 * Create Finding
 * BE belum punya field "category" → kita embed di `description` dengan format: [KATEGORI] catatan
 */
export async function createFinding({ agent_id, category, issued_at, notes }) {
  const description = category ? `[${category}] ${notes || ""}`.trim() : (notes || "");
  const body = { agent_id, description };
  if (issued_at) body.issued_at = issued_at; // RFC3339
  const { data } = await api.post("/findings", body);
  return data;
}

/**
 * List Findings (dengan filter opsional)
 * - month: "YYYY-MM"
 * - from/to: RFC3339
 */
export async function listFindings({ agent_id, month, from, to, page=1, size=50 } = {}) {
  const params = new URLSearchParams();
  if (agent_id) params.set("agent_id", agent_id);
  if (month) params.set("month", month);
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  params.set("page", page);
  params.set("size", size);
  const { data } = await api.get(`/findings?${params.toString()}`);
  return data; // { page, size, total, items: [...] }
}

/**
 * HANYA COUNTER untuk bulan tertentu (dipakai blok pengajuan cuti)
 * Supaya irit payload, minta size=1 dan ambil field `total` dari response BE.
 */
export async function getMyFindingCount(month) {
  const params = new URLSearchParams();
  if (month) params.set("month", month);
  params.set("page", "1");
  params.set("size", "1");
  const { data } = await api.get(`/findings?${params.toString()}`);
  // BE balikin { total } → kalau tidak ada, fallback ke panjang items
  const count = typeof data?.total === "number"
    ? data.total
    : (Array.isArray(data?.items) ? data.items.length : 0);
  return { count };
}

export async function deleteFinding(id) {
  const { data } = await api.delete(`/findings/${id}`);
  return data;
}
