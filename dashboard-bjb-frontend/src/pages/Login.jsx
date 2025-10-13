import React, { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthProvider";

const BACKOFFICE_ROLES = ["SUPER_ADMIN","SPV","QC","TL","HR_ADMIN"];

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // state agar tidak ada "email is not defined"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errMsg, setErrMsg] = useState("");

  const onSubmit = async (e) => {
    e.preventDefault();
    setErrMsg("");
    setSubmitting(true);
    try {
      // kirim flat JSON via helper login (objek agar kompat)
      const { user } = await login({ email, password });

      const from = location.state?.from?.pathname;
      if (from && from !== "/login") {
        navigate(from, { replace: true });
        return;
      }
      const roles = user?.roles || [];
      const isBackoffice = roles.some(r => BACKOFFICE_ROLES.includes(r));
      navigate(isBackoffice ? "/backoffice" : "/agent", { replace: true });
    } catch (err) {
      setErrMsg(err?.response?.data?.error || err?.message || "Login gagal");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="split" style={{ minHeight: "100vh", display: "grid", gridTemplateColumns: "1fr 1fr" }}>
      {/* Kiri: brand (tampilanmu semula) */}
      <section className="hero" style={{ background: "#0B1F3B", color: "#E9EEF6", padding: 32 }}>
        <div className="brand" style={{ fontWeight: 800, fontSize: 24, marginBottom: 16 }}>
          <div className="logoMark" style={{ display: "inline-block", width: 28, height: 28, background: "#FFC20E", borderRadius: 8, marginRight: 8 }} />
          bank bjb <small style={{ fontWeight: 400, opacity: 0.8 }}>Backoffice Suite</small>
        </div>
        <h1 style={{ marginTop: 8 }}>Welcome back 👋</h1>
        <p style={{ opacity: 0.85 }}>Silakan masuk untuk melanjutkan.</p>
      </section>

      {/* Kanan: form (tetap sama, hanya ditambah name + onSubmit) */}
      <section style={{ display: "grid", placeItems: "center", padding: 24, background: "#F4F6F8" }}>
        <form
          onSubmit={onSubmit}
          style={{ width: 380, background: "#fff", borderRadius: 16, padding: 20, boxShadow: "0 8px 24px rgba(0,0,0,.06)", display: "grid", gap: 12 }}
        >
          <h3 style={{ margin: 0 }}>Masuk</h3>

          <label className="label" style={{ fontSize: 13, color: "#6B7280" }}>Email</label>
          <input
            className="input"
            type="email"
            name="email"                          // penting untuk FormData juga
            placeholder="you@company.com"
            value={email} onChange={(e) => setEmail(e.target.value)}
            required
            style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #E5E7EB" }}
          />

          <label className="label" style={{ fontSize: 13, color: "#6B7280" }}>Kata sandi</label>
          <input
            className="input"
            type="password"
            name="password"                       // penting
            placeholder="••••••••"
            value={password} onChange={(e) => setPassword(e.target.value)}
            required
            style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #E5E7EB" }}
          />

          {errMsg && (
            <div style={{ background: "#FEF2F2", color: "#B91C1C", padding: "8px 10px", borderRadius: 8, fontSize: 13 }}>
              {errMsg}
            </div>
          )}

          <button
            className="btn"
            type="submit"
            disabled={submitting}
            style={{
              marginTop: 8, padding: "10px 12px", borderRadius: 10, border: "none",
              background: "#0B1F3B", color: "#fff", cursor: submitting ? "not-allowed" : "pointer", fontWeight: 700,
            }}
          >
            {submitting ? "Memproses..." : "Masuk"}
          </button>
        </form>
      </section>
    </div>
  );
}
