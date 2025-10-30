// src/pages/Profile.jsx
import React from "react";
import useAuth, { setStoredUser } from "../auth/useAuth";
import { getMe, updateMe, changeMyPassword, uploadMyPhoto } from "../api/users.me";
import { fileUrl } from "../api/client";
import toast, { Toaster } from "react-hot-toast";

export default function ProfilePage() {
  const { user } = useAuth();
  const [loading, setLoading] = React.useState(true);
  const [original, setOriginal] = React.useState(null);

  const [form, setForm] = React.useState({
    full_name: "", email: "", photo_url: "", current_password: "",
  });
  const [photoFile, setPhotoFile] = React.useState(null);

  React.useEffect(() => {
    (async () => {
      try {
        const me = await getMe();
        setOriginal(me);
        setForm((f) => ({
          ...f,
          full_name: me.full_name || me.name || "",
          email: me.email || "",
          photo_url: me.photo_url || "",
        }));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const S = {
    card: { background: "#fff", border: "1px solid #E5E7EB", borderRadius: 16, padding: 16 },
    input: { width: "100%", padding: "10px 12px", border: "1px solid #E5E7EB", borderRadius: 10, marginTop: 6 },
    label: { fontSize: 13, fontWeight: 600, color: "#111827" },
    btn: { padding: "10px 16px", background: "#111827", color: "#fff", border: "none", borderRadius: 10, cursor: "pointer" },
    btn2: { padding: "10px 16px", background: "#2563EB", color: "#fff", border: "none", borderRadius: 10, cursor: "pointer" },
  };

  function toStoredUser(u) {
    return { id:u.id, uuid:u.uuid, name:u.full_name || u.name, email:u.email, roles:u.roles, photo_url:u.photo_url };
  }

  async function onSaveAll(e) {
    e.preventDefault();
    if (!original) return;

    try {
      let nextPhotoURL = original.photo_url || "";
      if (photoFile) {
        const up = await uploadMyPhoto(photoFile);
        nextPhotoURL = up.photo_url;
      }

      const payload = {};
      if (form.full_name !== (original.full_name || "")) payload.full_name = form.full_name;

      const emailChanged = form.email !== (original.email || "");
      if (emailChanged) {
        payload.email = form.email;
        if (form.current_password) payload.current_password = form.current_password;
      }
      if (nextPhotoURL !== (original.photo_url || "")) payload.photo_url = nextPhotoURL;

      if (Object.keys(payload).length === 0) {
        toast("Tidak ada perubahan.");
        setPhotoFile(null);
        return;
      }

      const updated = await updateMe(payload);
      setOriginal(updated);
      setStoredUser(toStoredUser(updated), true);
      setForm((f) => ({ ...f, current_password: "", photo_url: updated.photo_url || f.photo_url }));
      setPhotoFile(null);
      toast.success("Profil tersimpan ✅");
    } catch (e2) {
      toast.error(e2?.response?.data?.error || "Gagal menyimpan profil");
    }
  }

  if (loading) return <p>Memuat…</p>;
  const displayName = original?.full_name || original?.name;

  return (
    <div style={{ maxWidth: 820 }}>
      <Toaster position="top-right" />
      <h2 style={{ fontWeight: 800, marginBottom: 12 }}>Profil</h2>

      {/* Kartu utama: Foto + Nama + Email + URL + 1 tombol Simpan */}
      <form onSubmit={onSaveAll} style={{ ...S.card, marginBottom: 20 }}>
        <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: 20, alignItems: "center", marginBottom: 12 }}>
          <img
            src={form.photo_url ? fileUrl(form.photo_url) : "https://dummyimage.com/96x96/e5e7eb/555&text=👤"}
            alt="avatar" width={96} height={96}
            style={{ borderRadius: 999, objectFit: "cover", boxShadow: "0 4px 16px rgba(0,0,0,.08)" }}
          />
          <div>
            <div style={{ fontWeight: 800, fontSize: 18, marginBottom: 2 }}>{displayName}</div>
            <div style={{ opacity: .7 }}>{original?.email}</div>
          </div>
        </div>

        <div style={{ display: "grid", gap: 12 }}>
          <div>
            <div style={S.label}>Upload Foto (jpg/png, maks ~2 MB)</div>
            <input type="file" accept="image/*" onChange={(e)=>setPhotoFile(e.target.files?.[0] || null)} style={S.input}/>
          </div>

          <div>
            <div style={S.label}>Nama Lengkap</div>
            <input value={form.full_name} onChange={(e)=>setForm(v=>({...v, full_name:e.target.value}))} style={S.input}/>
          </div>

          <div>
            <div style={S.label}>Email</div>
            <input type="email" value={form.email} onChange={(e)=>setForm(v=>({...v, email:e.target.value}))} style={S.input}/>
          </div>

          {form.email !== (original?.email || "") && (
            <div>
              <div style={S.label}>Current Password (hanya jika ganti email)</div>
              <input type="password" value={form.current_password} onChange={(e)=>setForm(v=>({...v, current_password:e.target.value}))} style={S.input}/>
            </div>
          )}
        </div>

        <div style={{ marginTop: 14 }}>
          <button type="submit" style={S.btn}>Simpan</button>
        </div>
      </form>

      {/* Ganti Password */}
      <div style={S.card}>
        <div style={{ fontSize: 18, fontWeight: 800, margin: "8px 0 12px" }}>Ganti Password</div>
        <PasswordForm />
      </div>
    </div>
  );
}

/* ====== Komponen kecil: Ganti Password (eye-toggle, strength meter, confirm, toast) ====== */
function PasswordForm() {
  const [pwd, setPwd] = React.useState({ current: "", new_password: "", confirm: "" });
  const [show, setShow] = React.useState({ current:false, new:false, confirm:false });
  const [errors, setErrors] = React.useState({ current: "", new_password: "", confirm: "" });
  const [loading, setLoading] = React.useState(false);

  const S = {
    input: (hasErr) => ({
      width: "100%", padding: "10px 12px",
      border: `1px solid ${hasErr ? "#DC2626" : "#E5E7EB"}`,
      borderRadius: 10, marginTop: 6, outline: "none",
    }),
    label: { fontSize: 13, fontWeight: 600, color: "#111827" },
    btn: {
      padding: "10px 16px", background: "#2563EB", color: "#fff",
      border: "none", borderRadius: 10, cursor: "pointer", opacity: loading ? .6 : 1
    },
    helpErr: { color: "#DC2626", fontSize: 12, marginTop: 4 },
    row: { position:"relative" },
    eye: { position:"absolute", right:10, top:38, border:"none", background:"transparent", cursor:"pointer" }
  };

  function calcStrength(s) {
    let score = 0;
    if (s.length >= 6) score++;
    if (/[A-Z]/.test(s)) score++;
    if (/[a-z]/.test(s)) score++;
    if (/\d/.test(s)) score++;
    if (/[^A-Za-z0-9]/.test(s)) score++; // bonus
    return Math.min(score, 4); // 0..4
  }
  const strength = calcStrength(pwd.new_password);

  function StrengthBar() {
    const colors = ["#E5E7EB","#F59E0B","#F59E0B","#10B981","#059669"];
    const label  = ["Lemah","Kurang","Cukup","Kuat","Sangat kuat"][strength] || "Lemah";
    return (
      <div style={{ marginTop: 6 }}>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:6 }}>
          {[0,1,2,3].map(i=>(
            <div key={i} style={{ height:8, borderRadius:999, background: i<=strength-1 ? colors[strength] : "#E5E7EB" }}/>
          ))}
        </div>
        <div style={{ fontSize:12, marginTop:4, color:"#6B7280" }}>Kekuatan: {label}</div>
      </div>
    );
  }

  function validate() {
    const e = { current:"", new_password:"", confirm:"" };
    if (!pwd.current) e.current = "Password saat ini wajib diisi.";
    if (!pwd.new_password) e.new_password = "Password baru wajib diisi.";
    else if (pwd.new_password.length < 6) e.new_password = "Minimal 6 karakter.";
    if (pwd.confirm !== pwd.new_password) e.confirm = "Konfirmasi tidak cocok.";
    setErrors(e);
    return !e.current && !e.new_password && !e.confirm;
  }

  async function onSubmit(e) {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    try {
      // ⬇️ penting: backend expects 'new', bukan 'new_password'
      await changeMyPassword({ current: pwd.current, new_password: pwd.new_password });
      setPwd({ current:"", new_password:"", confirm:"" });
      toast.success("Password berhasil diganti ✅");
      setErrors({ current:"", new_password:"", confirm:"" });
    } catch (ex) {
      const m = ex?.response?.data?.error || "";
      if (m.toLowerCase().includes("current password is incorrect")) {
        setErrors((prev)=>({ ...prev, current: "Password saat ini salah." }));
        toast.error("Password saat ini salah.");
      } else if (m.toLowerCase().includes("required") || m.toLowerCase().includes("min=6")) {
        toast.error(m || "Validasi gagal");
      } else {
        toast.error(m || "Gagal ganti password");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} style={{ display:"grid", gap:12 }}>
      {/* Current */}
      <div style={S.row}>
        <div style={S.label}>Password saat ini</div>
        <input
          type={show.current ? "text":"password"}
          value={pwd.current}
          onChange={(e)=>{ setPwd(v=>({...v, current:e.target.value})); setErrors(s=>({...s, current:""})); }}
          style={S.input(!!errors.current)}
          placeholder="••••••"
          autoComplete="current-password"
        />
        <button type="button" style={S.eye} onClick={()=>setShow(v=>({...v, current:!v.current}))}>{show.current ? "🙈" : "👁"}</button>
        {errors.current && <div style={S.helpErr}>{errors.current}</div>}
      </div>

      {/* New */}
      <div style={S.row}>
        <div style={S.label}>Password baru</div>
        <input
          type={show.new ? "text":"password"}
          value={pwd.new_password}
          onChange={(e)=>{ setPwd(v=>({...v, new_password:e.target.value})); setErrors(s=>({...s, new_password:""})); }}
          style={S.input(!!errors.new_password)}
          placeholder="Minimal 6 karakter"
          autoComplete="new-password"
        />
        <button type="button" style={S.eye} onClick={()=>setShow(v=>({...v, new:!v.new}))}>{show.new ? "🙈" : "👁"}</button>
        {errors.new_password && <div style={S.helpErr}>{errors.new_password}</div>}
        <StrengthBar />
      </div>

      {/* Confirm */}
      <div style={S.row}>
        <div style={S.label}>Konfirmasi password baru</div>
        <input
          type={show.confirm ? "text":"password"}
          value={pwd.confirm}
          onChange={(e)=>{ setPwd(v=>({...v, confirm:e.target.value})); setErrors(s=>({...s, confirm:""})); }}
          style={S.input(!!errors.confirm)}
          placeholder="Ulangi password baru"
          autoComplete="new-password"
        />
        <button type="button" style={S.eye} onClick={()=>setShow(v=>({...v, confirm:!v.confirm}))}>{show.confirm ? "🙈" : "👁"}</button>
        {errors.confirm && <div style={S.helpErr}>{errors.confirm}</div>}
      </div>

      <div>
        <button type="submit" style={S.btn} disabled={loading}>
          {loading ? "Menyimpan..." : "Ubah Password"}
        </button>
      </div>
    </form>
  );
}
