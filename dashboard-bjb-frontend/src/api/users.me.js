import api from "./client";

/** GET /me — ambil profil diri sendiri */
export async function getMe() {
  const { data } = await api.get("/me");
  // normalisasi name utk komponen yg pakai user.name
  return { ...data, name: data.full_name || data.name };
}

/** PUT /me — update profil diri sendiri (kirim hanya field yg berubah) */
export async function updateMe(payload) {
  const { data } = await api.put("/me", payload);
  return { ...data, name: data.full_name || data.name };
}

/** PUT /me/password — ganti password diri sendiri */
export async function changeMyPassword({ current, new_password }) {
  // backend kamu: { current, new }
  return api.put("/me/password", { current, new: new_password });
}

/** POST /me/photo — upload avatar (multipart) */
export async function uploadMyPhoto(file) {
  const fd = new FormData();
  fd.append("file", file);
  const { data } = await api.post("/me/photo", fd, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  // { photo_url: "/uploads/avatars/xxx.jpg" }
  return data;
}
