import React from "react";
import dayjs from "dayjs";
import useNotifications from "../hooks/useNotifications";
import { listSwaps } from "../api/swaps";
import { listUsersMini } from "../api/users";

function extractNameFromBody(body, which) {
  if (!body) return null;
  if (which === "requester") {
    const m1 = body.match(/^(.+?)\s+mengajukan tukar/i);
    if (m1?.[1]) return m1[1].trim();
    const mOld1 = body.match(/^(.+?)\s+\(ID\s*#\d+\)\s+mengajukan tukar/i);
    if (mOld1?.[1]) return mOld1[1].trim();
  }
  if (which === "counterparty") {
    const m2 = body.match(/disetujui oleh\s+(.+?)\s*(?:•|$)/i);
    if (m2?.[1]) return m2[1].trim();
    const mOld2 = body.match(/disetujui oleh\s+(.+?)\s+\(ID\s*#\d+\)/i);
    if (mOld2?.[1]) return mOld2[1].trim();
  }
  if (which === "other") {
    const m3 = body.match(/dengan\s+(.+?)\s*(?:•|$)/i);
    if (m3?.[1]) return m3[1].trim();
    const mOld3 = body.match(/dengan\s+(.+?)\s+\(ID\s*#\d+\)/i);
    if (mOld3?.[1]) return mOld3[1].trim();
  }
  return null;
}

export default function NotificationPanel({ open, onClose }) {
  const { items, setRead, reload } = useNotifications(20000);
  const [swaps, setSwaps] = React.useState([]);
  const [nameById, setNameById] = React.useState({});
  const [refreshing, setRefreshing] = React.useState(false);

  const loadSwapsAndUsers = React.useCallback(async () => {
    try {
      setRefreshing(true);
      const [swRes, userRes] = await Promise.all([
        listSwaps({ page: 1, size: 500 }),
        listUsersMini({}),
      ]);
      const sitems = swRes.items || [];
      const m = {};
      (userRes.items || []).forEach((u) => (m[u.id] = u.full_name || `Agent #${u.id}`));
      setSwaps(sitems);
      setNameById(m);
      console.debug("[notif-panel] swaps loaded:", sitems.length);
      console.debug("[notif-panel] users loaded:", Object.keys(m).length);
    } catch (e) {
      console.warn("[notif-panel] failed to load swaps/users:", e);
    } finally {
      setRefreshing(false);
    }
  }, []);

  React.useEffect(() => { loadSwapsAndUsers(); }, [loadSwapsAndUsers]);

  const hardRefresh = async () => {
    await Promise.all([reload(), loadSwapsAndUsers()]);
  };

  const findSwap = (id) => swaps.find((s) => s.id === id);
  const channelLabel = (ch) => (ch && String(ch).trim() !== "" ? ch : "—");

  return (
    <aside style={{
      position: "fixed", top: 0, right: 0, height: "100vh", width: 380,
      transform: open ? "translateX(0)" : "translateX(100%)",
      transition: "transform .25s ease", background: "#fff",
      borderLeft: "1px solid #E5E7EB", boxShadow: "-6px 0 20px rgba(0,0,0,.06)", zIndex: 60,
    }}>
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        padding: "12px 14px", borderBottom: "1px solid #EEF2F7", gap: 8,
      }}>
        <b>Notifikasi</b>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={hardRefresh}
            disabled={refreshing}
            title="Refresh notifikasi dan data swap"
            style={{
              border: "1px solid #E5E7EB",
              background: refreshing ? "#F3F4F6" : "#F9FAFB",
              borderRadius: 8, padding: "6px 10px",
              cursor: refreshing ? "not-allowed" : "pointer", fontSize: 12,
            }}
          >
            {refreshing ? "Merefresh…" : "Refresh"}
          </button>
          <button onClick={onClose} style={{ border: "none", background: "transparent", cursor: "pointer" }}>
            ✕
          </button>
        </div>
      </div>

      <div style={{ padding: 12, display: "grid", gap: 10, overflowY: "auto", height: "calc(100vh - 50px)" }}>
        {items.map((n) => {
          const sw = n.ref_type === "SWAP" && n.ref_id ? findSwap(n.ref_id) : null;

          const isApproved = /^swap disetujui/i.test(n.title || "");

          const reqName =
            (sw && (sw.requester_name || nameById[sw.requester_id])) ||
            (sw?.requester_id ? `Agent #${sw.requester_id}` : "—");

         const cpName =
            (sw && (sw.counterparty_name || (sw.counterparty_id && nameById[sw.counterparty_id]))) ||
            extractNameFromBody(n.body, "counterparty") ||
            extractNameFromBody(n.body, "other") ||
            (sw?.counterparty_id ? `Agent #${sw.counterparty_id}` : "—");


          const start = sw?.start_at ? dayjs(sw.start_at) : null;
          const end = sw?.end_at ? dayjs(sw.end_at) : null;
          const tanggal = start ? start.format("DD MMM YYYY") : "—";
          const jam = start && end ? `${start.format("HH:mm")}–${end.format("HH:mm")}` : "—";
          const channel = sw?.channel ? channelLabel(sw.channel) : "—";
          const alasan = sw?.reason || null;

          return (
            <div key={n.id} style={{
              border: "1px solid #E5E7EB", borderRadius: 12, padding: 12,
              background: n.is_read ? "#fff" : "linear-gradient(180deg,#FFFDF6,#FFFFFF)",
            }}>
              <div style={{ fontSize: 12, color: "#6B7280" }}>
                {dayjs(n.created_at).format("DD MMM YYYY HH:mm")}
              </div>
              <div style={{ fontWeight: 800, margin: "4px 0 10px" }}>{n.title}</div>

              {sw ? (
                isApproved ? (
                  <div style={{ fontSize: 13, lineHeight: 1.55 }}>
                    <div><b>Jadwal:</b> Pengajuan oleh <b>{reqName}</b></div>
                    <div><b>Tanggal:</b> {tanggal}</div>
                    <div><b>Jam:</b> {jam}</div>
                    <div><b>Channel:</b> {channel}</div>
                    <div><b>Disetujui oleh:</b> {cpName}</div>
                    {alasan && <div><b>Alasan:</b> {alasan}</div>}
                  </div>
                ) : (
                  <div style={{ fontSize: 13, lineHeight: 1.55 }}>
                    <div><b>Nama:</b> {reqName}</div>
                    <div><b>Tanggal:</b> {tanggal}</div>
                    <div><b>Jam:</b> {jam}</div>
                    <div><b>Channel:</b> {channel}</div>
                    {alasan && <div><b>Alasan:</b> {alasan}</div>}
                  </div>
                )
              ) : (
                <div style={{ whiteSpace: "pre-wrap" }}>{n.body}</div>
              )}

              <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                {!n.is_read && (
                  <button
                    onClick={() => setRead(n.id)}
                    style={{
                      border: "1px solid #E5E7EB", background: "#F9FAFB",
                      borderRadius: 8, padding: "6px 10px", cursor: "pointer",
                    }}
                  >
                    Tandai dibaca
                  </button>
                )}
                <button
                  onClick={hardRefresh}
                  title="Refresh item ini"
                  style={{
                    border: "1px solid #E5E7EB", background: "#F9FAFB",
                    borderRadius: 8, padding: "6px 10px", cursor: "pointer",
                  }}
                >
                  Refresh
                </button>
              </div>
            </div>
          );
        })}
        {items.length === 0 && (
          <div style={{ color: "#9CA3AF", textAlign: "center", marginTop: 24 }}>
            Tidak ada notifikasi.
          </div>
        )}
      </div>
    </aside>
  );
}
