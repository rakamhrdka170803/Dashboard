import React from "react";
import NotificationPanel from "./NotificationPanel";
import useNotifications from "../hooks/useNotifications";

export default function Topbar({ title }) {
  const { unreadCount } = useNotifications();
  const [open, setOpen] = React.useState(false);

  return (
    <header
      style={{
        background: "#fff",
        borderBottom: "1px solid #EEF2F7",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 16px",
      }}
    >
      <h3 style={{ margin: 0 }}>{title}</h3>
      <button
        onClick={() => setOpen(true)}
        style={{ position: "relative", border: "none", background: "transparent", cursor: "pointer", fontSize: 20 }}
      >
        🔔
        {unreadCount > 0 && (
          <span
            style={{
              position: "absolute",
              top: -6,
              right: -6,
              background: "#DC2626",
              color: "#fff",
              borderRadius: 999,
              fontSize: 11,
              padding: "1px 6px",
              fontWeight: 800,
            }}
          >
            {unreadCount}
          </span>
        )}
      </button>
      <NotificationPanel open={open} onClose={() => setOpen(false)} />
    </header>
  );
}
