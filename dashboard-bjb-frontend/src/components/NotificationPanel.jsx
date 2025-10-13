import React from "react";
import dayjs from "dayjs";
import useNotifications from "../hooks/useNotifications";
import { listSwaps } from "../api/swaps";

// Ambil nama dari body notifikasi (format baru & lama)
function extractNameFromBody(body, which) {
  if (!body) return null;

  // format baru
  if (which === "requester") {
    const m1 = body.match(/^(.+?)\s+mengajukan tukar/i);
    if (m1?.[1]) return m1[1].trim();
  }
  if (which === "approver") {
    const m2 = body.match(/disetujui oleh\s+(.+?)\s*(?:•|$)/i);
    if (m2?.[1]) return m2[1].trim();
  }
  if (which === "other") {
    const m3 = body.match(/dengan\s+(.+?)\s*(?:•|$)/i);
    if (m3?.[1]) return m3[1].trim();
  }

  // kompat lama (ada "(ID #..)")
  if (which === "requester") {
    const mOld1 = body.match(/^(.+?)\s+\(ID\s*#\d+\)\s+mengajukan tukar/i);
    if (mOld1?.[1]) return mOld1[1].trim();
  }
  if (which === "approver") {
    const mOld2 = body.match(/disetujui oleh\s+(.+?)\s+\(ID\s*#\d+\)/i);
    if (mOld2?.[1]) return mOld2[1].trim();
  }
  if (which === "other") {
    const mOld3 = body.match(/dengan\s+(.+?)\s+\(ID\s*#\d+\)/i);
    if (mOld3?.[1]) return mOld3[1].trim();
  }
  return null;
}

// Label channel rapi
function channelLabel(ch) {
  if (!ch) return "—";
  return ch === "VOICE" ? "VOICE" : ch === "SOSMED" ? "SOSMED" : String(ch);
}

export default function NotificationPanel({ open, onClose }) {
  const { items, setRead } = useNotifications(20000);
  const [swaps, setSwaps] = React.useState([]);

  React.useEffect(() => {
    listSwaps({ page: 1, size: 200 }).then((r) => setSwaps(r.items || []));
  }, []);

  const findSwap = (id) => swaps.find((s) => s.id === id);

  return (
    <aside
      style={{
        position: "fixed",
        top: 0,
        right: 0,
        height: "100vh",
        width: 380,
        transform: open ? "translateX(0)" : "translateX(100%)",
        transition: "transform .25s ease",
        background: "#fff",
        borderLeft: "1px solid #E5E7EB",
        boxShadow: "-6px 0 20px rgba(0,0,0,.06)",
        zIndex: 60,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "12px 14px",
          borderBottom: "1px solid #EEF2F7",
        }}
      >
        <b>Notifikasi</b>
        <button
          onClick={onClose}
          style={{ border: "none", background: "transparent", cursor: "pointer" }}
        >
          ✕
        </button>
      </div>

      <div
        style={{
          padding: 12,
          display: "grid",
          gap: 10,
          overflowY: "auto",
          height: "calc(100vh - 50px)",
        }}
      >
        {items.map((n) => {
          const sw = n.ref_type === "SWAP" && n.ref_id ? findSwap(n.ref_id) : null;
          const reqName = extractNameFromBody(n.body, "requester");
          const approverName = extractNameFromBody(n.body, "approver") || extractNameFromBody(n.body, "other");
          const ch = sw?.channel || null; // <— DAPAT dari backend

          // tipe notifikasi sederhana
          const isRequest = n.title?.toLowerCase().includes("permintaan");
          const isApproved = n.title?.toLowerCase().includes("disetujui") || n.title?.toLowerCase().includes("approved");

          return (
            <div
              key={n.id}
              style={{
                border: "1px solid #E5E7EB",
                borderRadius: 12,
                padding: 12,
                background: n.is_read ? "#fff" : "linear-gradient(180deg,#FFFDF6,#FFFFFF)",
              }}
            >
              <div style={{ fontSize: 12, color: "#6B7280" }}>
                {dayjs(n.created_at).format("DD MMM YYYY HH:mm")}
              </div>
              <div style={{ fontWeight: 800, margin: "4px 0 6px" }}>{n.title}</div>

              {sw ? (
                <div style={{ fontSize: 13, lineHeight: 1.6 }}>
                  {isRequest && (
                    <>
                      <div><b>Nama:</b> {reqName || "—"}</div>
                      <div><b>Tanggal:</b> {dayjs(sw.start_at).format("DD MMM YYYY")}</div>
                      <div>
                        <b>Jam:</b> {dayjs(sw.start_at).format("HH:mm")}–{dayjs(sw.end_at).format("HH:mm")}
                      </div>
                      <div><b>Channel:</b> {channelLabel(ch)}</div>
                      {sw.reason && <div><b>Alasan:</b> {sw.reason}</div>}
                    </>
                  )}

                  {isApproved && (
                    <>
                      <div>
                        <b>Jadwal:</b> Pengajuan oleh {reqName || "—"}
                      </div>
                      <div><b>Tanggal:</b> {dayjs(sw.start_at).format("DD MMM YYYY")}</div>
                      <div>
                        <b>Jam:</b> {dayjs(sw.start_at).format("HH:mm")}–{dayjs(sw.end_at).format("HH:mm")}
                      </div>
                      <div><b>Channel:</b> {channelLabel(ch)}</div>
                      {approverName && <div><b>Disetujui oleh:</b> {approverName}</div>}
                      {sw.reason && <div><b>Alasan:</b> {sw.reason}</div>}
                    </>
                  )}

                  {!isRequest && !isApproved && (
                    <>
                      <div><b>Tanggal:</b> {dayjs(sw.start_at).format("DD MMM YYYY")}</div>
                      <div>
                        <b>Jam:</b> {dayjs(sw.start_at).format("HH:mm")}–{dayjs(sw.end_at).format("HH:mm")}
                      </div>
                      <div><b>Channel:</b> {channelLabel(ch)}</div>
                      {sw.reason && <div><b>Alasan:</b> {sw.reason}</div>}
                    </>
                  )}
                </div>
              ) : (
                <div style={{ whiteSpace: "pre-wrap" }}>{n.body}</div>
              )}

              {!n.is_read && (
                <button
                  onClick={() => setRead(n.id)}
                  style={{
                    marginTop: 8,
                    border: "1px solid #E5E7EB",
                    background: "#F9FAFB",
                    borderRadius: 8,
                    padding: "6px 10px",
                    cursor: "pointer",
                  }}
                >
                  Tandai dibaca
                </button>
              )}
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
