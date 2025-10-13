import api from "./client";

/** daftar user lengkap (khusus role backoffice) */
export async function listUsers({ page = 1, size = 50 } = {}) {
  const params = new URLSearchParams({ page, size });
  const { data } = await api.get(`/users?${params.toString()}`);
  return data; // {page,size,total,items:[{id,full_name,email,roles,...}]}
}

/** daftar user ringan (id + full_name) untuk dropdown — boleh diakses semua yang login */
export async function listUsersMini({ page = 1, size = 1000 } = {}) {
  const params = new URLSearchParams({ page, size });
  const { data } = await api.get(`/users/mini?${params.toString()}`);
  // backend mengembalikan {items:[{id, full_name}]}
  return data?.items || [];
}
