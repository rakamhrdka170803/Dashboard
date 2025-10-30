import React from "react";
import NotificationPanel from "./NotificationPanel";
import useNotifications from "../hooks/useNotifications";
import useAuth from "../auth/useAuth";
import { useNavigate } from "react-router-dom";
import { fileUrl } from "../api/client";

export default function Topbar({ title }) {
  const { unreadCount } = useNotifications();
  const { user, logout } = useAuth();
  const [open, setOpen] = React.useState(false);
  const [menuOpen, setMenuOpen] = React.useState(false);
  const navigate = useNavigate();

  // tampilkan nama dari name/full_name
  const displayName = user?.name || user?.full_name || "User";
  const roles = user?.roles || [];
  const profilePath = roles.includes("AGENT") ? "/agent/profile" : "/backoffice/profile";

  const initials = displayName
    .split(" ")
    .map((s) => s[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const avatar = user?.photo_url
    ? (
      <img
        src={fileUrl(user.photo_url)}
        alt="avatar"
        style={{ width: 32, height: 32, borderRadius: 999, objectFit: "cover" }}
      />
    )
    : (
      <div
        style={{
          width: 32, height: 32, borderRadius: 999, display: "grid",
          placeItems: "center", background: "#E5E7EB", fontSize: 12, fontWeight: 700,
        }}
      >
        {initials}
      </div>
    );

  return (
    <header
      style={{
        background: "#fff",
        borderBottom: "1px solid #EEF2F7",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 16px",
        position: "relative",
      }}
    >
      <h3 style={{ margin: 0 }}>{title}</h3>

      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <button
          onClick={() => setOpen(true)}
          style={{ position: "relative", border: "none", background: "transparent", cursor: "pointer", fontSize: 20 }}
          aria-label="Open notifications"
        >
          🔔
          {unreadCount > 0 && (
            <span
              style={{
                position: "absolute", top: -6, right: -6, background: "#DC2626", color: "#fff",
                borderRadius: 999, fontSize: 11, padding: "1px 6px", fontWeight: 800,
              }}
            >
              {unreadCount}
            </span>
          )}
        </button>

        {/* User menu: foto + nama, opsi Edit Profil & Logout */}
        <div style={{ position: "relative" }}>
          <button
            onClick={() => setMenuOpen((v) => !v)}
            style={{
              display: "flex", alignItems: "center", gap: 8,
              border: "1px solid #E5E7EB", background: "white",
              padding: "6px 10px", borderRadius: 999, cursor: "pointer",
            }}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
          >
            {avatar}
            <span style={{ fontSize: 12, fontWeight: 600 }}>{displayName}</span>
            <span style={{ fontSize: 12, opacity: 0.6 }}>▾</span>
          </button>

          {menuOpen && (
            <div
              role="menu"
              style={{
                position: "absolute", right: 0, marginTop: 6, background: "white",
                border: "1px solid #E5E7EB", borderRadius: 12, boxShadow: "0 10px 24px rgba(0,0,0,.08)",
                minWidth: 200, zIndex: 40,
              }}
            >
              <button
                role="menuitem"
                onClick={() => { setMenuOpen(false); navigate(profilePath); }}
                style={{ display: "block", width: "100%", textAlign: "left", padding: "10px 12px",
                         background: "white", border: "none", cursor: "pointer" }}
              >
                Edit Profil
              </button>
              <hr style={{ margin: 0, border: "none", borderTop: "1px solid #F3F4F6" }} />
              <button
                role="menuitem"
                onClick={() => { setMenuOpen(false); logout(); }}
                style={{ display: "block", width: "100%", textAlign: "left", padding: "10px 12px",
                         background: "white", border: "none", cursor: "pointer",
                         color: "#DC2626", fontWeight: 700 }}
              >
                Logout
              </button>
            </div>
          )}
        </div>
      </div>

      <NotificationPanel open={open} onClose={() => setOpen(false)} />
    </header>
  );
}
