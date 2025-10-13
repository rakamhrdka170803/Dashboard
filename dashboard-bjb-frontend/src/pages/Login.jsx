import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthProvider";
import "../styles.css";

const BACKOFFICE_ROLES = ["SUPER_ADMIN", "SPV", "QC", "TL", "HR_ADMIN"];
const agentOnly = (roles = []) => roles.includes("AGENT") && roles.every((r) => r === "AGENT");

export default function Login() {
  const { login } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPass] = useState("");
  const [remember, setRemember] = useState(false);
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const onSubmit = async (e) => {
    e.preventDefault();
    setErr("");
    setLoading(true);
    try {
      const user = await login(email.trim(), password, remember);
      if (agentOnly(user.roles || [])) nav("/agent", { replace: true });
      else if ((user.roles || []).some((r) => BACKOFFICE_ROLES.includes(r))) nav("/backoffice", { replace: true });
      else nav("/agent", { replace: true });
    } catch (e) {
      setErr(e?.response?.data?.error || "Login gagal. Periksa email/password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="split">
      <section className="hero">
        <div className="brand"><div className="logoMark" />bank bjb <small>Backoffice Suite</small></div>
        <h1>Welcome back 👋</h1>
        <p>Akses dasbor performa, temuan QC, jadwal & pengajuan agent dalam satu tempat.</p>
      </section>

      <section className="formSide">
        <div className="card">
          <div className="badge">Secure Access</div>
          <h2 style={{ margin: "14px 0 4px" }}>Masuk ke akun Anda</h2>
          <p className="helper">Gunakan email kantor & sandi Anda</p>

          <form onSubmit={onSubmit} style={{ marginTop: 16, display: "grid", gap: 14 }}>
            <label className="label" htmlFor="email">Email</label>
            <input id="email" className="input" type="email" placeholder="nama@bjb.co.id" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus required />

            <label className="label" htmlFor="password">Password</label>
            <div style={{ position: "relative" }}>
              <input id="password" className="input" type={showPwd ? "text" : "password"} placeholder="••••••••" value={password} onChange={(e) => setPass(e.target.value)} required minLength={6} style={{ paddingRight: 44 }} />
              <button type="button" onClick={() => setShowPwd((s) => !s)} className="ghostIconBtn">{showPwd ? "Hide" : "Show"}</button>
            </div>

            <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
              Ingat saya (boleh lintas tab)
            </label>

            {err && <div className="err">{err}</div>}
            <button className="btn" disabled={loading}>{loading ? "Memproses..." : "Masuk"}</button>
          </form>
        </div>
      </section>
    </div>
  );
}
