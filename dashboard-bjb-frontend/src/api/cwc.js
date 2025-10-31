import api from "./client";

export async function getCWCCategories() {
  const { data } = await api.get("/cwc/categories");
  return data.categories;
}
export async function upsertCWCDaily({ date, complaint, request, info }) {
  const { data } = await api.post("/cwc/daily", { date, complaint, request, info });
  return data;
}
export async function queryCWC({ start, end }) {
  const { data } = await api.get("/cwc", { params: { start, end } });
  return data;
}
// NEW:
export async function getCWCDaily(date) {
  const { data } = await api.get("/cwc/daily", { params: { date } });
  return data; // {date, complaint:[], request:[], info:[]}
}
export async function deleteCWCDaily(date) {
  const { data } = await api.delete("/cwc/daily", { params: { date } });
  return data;
}
