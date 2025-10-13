import api from "./client";

export async function listUsers({ page = 1, size = 100 } = {}) {
  const { data } = await api.get(`/users?page=${page}&size=${size}`);
  // server mengembalikan {page,size,total,items:[{id,full_name,email,...}]}
  return data;
}
