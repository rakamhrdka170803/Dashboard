import React, { useEffect, useMemo, useState } from "react";
import dayjs from "dayjs";
import { createSwap, listSwaps, acceptSwap, cancelSwap } from "../../api/swaps";
import { listMonthly } from "../../api/schedules";
import { useAuth } from "../../context/AuthProvider";
import { listUsersMini } from "../../api/users";

export default function AgentSwap() {
  const { user } = useAuth();
  const isAgent = (user?.roles || []).includes("AGENT");
  const myId = user?.id;

  // map userId -> full_name (fallback jika requester_name dari BE kosong)
  const [nameById, setNameById] = useState({});

  // ---- State ----
  const [month, setMonth] = useState(dayjs().format("YYYY-MM"));
  const [mySchedules, setMySchedules] = useState([]);

  // Ajukan
  const [selectedMySchForRequest, setSelectedMySchForRequest] = useState("");
  const selectedSch = useMemo(
    () => mySchedules.find((s) => String(s.id) === String(selectedMySchForRequest)),
    [selectedMySchForRequest, mySchedules]
  );
  const endDisp = selectedSch ? dayjs(selectedSch.end_at).format("HH:mm") : "--:--";
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState("");

  // Lists
  const [pendingOthers, setPendingOthers] = useState([]); // pending milik orang lain
  const [myPending, setMyPending] = useState([]); // pending pengajuan saya

  // Modal Accept
  const [acceptOpen, setAcceptOpen] = useState(false);
  const [acceptTarget, setAcceptTarget] = useState(null);
  const [selectedMySchForAccept, setSelectedMySchForAccept] = useState("");

  // ---- Loaders ----
  const loadMySchedules = async () => {
    const { items } = await listMonthly({ month });
    setMySchedules(items || []);
  };

  const loadPendingOthers = async () => {
    const { items } = await listSwaps({ page: 1, size: 100 });
    const rows = (items || []).filter(
      (it) => it.status === "PENDING" && it.requester_id !== myId
    );
    setPendingOthers(rows);
  };

  const loadMyPending = async () => {
    const { items } = await listSwaps({ page: 1, size: 100 });
    const rows = (items || []).filter(
      (it) => it.status === "PENDING" && it.requester_id === myId
    );
    setMyPending(rows);
  };

  const reloadAll = async () => {
    await Promise.all([loadMySchedules(), loadPendingOthers(), loadMyPending()]);
  };

  useEffect(() => {
    loadMySchedules();
  }, [month]);

  useEffect(() => {
    loadPendingOthers();
    loadMyPending();
  }, [myId]);

  // ---- Actions ----
  const submitSwap = async (e) => {
    e.preventDefault();
    if (!isAgent) {
      setMsg("Hanya agent yang dapat mengajukan.");
      return;
    }
    if (!selectedSch) {
      setMsg("Pilih salah satu jadwal Anda.");
      return;
    }

    setSubmitting(true);
    setMsg("");
    try {
      await createSwap({
        start_at: dayjs(selectedSch.start_at).toISOString(),
        reason: reason.trim(),
      });
      setMsg("Swap berhasil diajukan. Menunggu agent lain meng-accept.");
      setReason("");
      setSelectedMySchForRequest("");
      await loadMyPending();
    } catch (err) {
      setMsg(err?.response?.data?.error || "Gagal mengajukan swap.");
    } finally {
      setSubmitting(false);
    }
  };

  const openAcceptModal = (swap) => {
    setAcceptTarget(swap);
    setSelectedMySchForAccept("");
    setAcceptOpen(true);
  };

  const candidateForAccept = useMemo(() => {
    if (!acceptTarget) return [];
    // semua jadwal saya kecuali window yang sama dengan pengaju
    return (mySchedules || []).filter(
      (s) =>
        !(
          dayjs(s.start_at).isSame(acceptTarget.start_at) &&
          dayjs(s.end_at).isSame(acceptTarget.end_at)
        )
    );
  }, [acceptTarget, mySchedules]);

  const doAccept = async () => {
    if (!acceptTarget || !selectedMySchForAccept) return;
    try {
      await acceptSwap({
        swapId: acceptTarget.id,
        counterparty_schedule_id: Number(selectedMySchForAccept),
      });
      setAcceptOpen(false);
      await reloadAll();
      alert("Swap di-accept. Jadwal telah diperbarui.");
    } catch (err) {
      alert(err?.response?.data?.error || "Gagal accept swap.");
    }
  };

  const cancelMySwap = async (sw) => {
    if (!confirm(`Batalkan permintaan #${sw.id}?`)) return;
    try {
      await cancelSwap({ swapId: sw.id });
      await loadMyPending();
    } catch (err) {
      alert(err?.response?.data?.error || "Gagal membatalkan.");
    }
  };

  // === Nama user untuk fallback ===
  useEffect(() => {
    (async () => {
      try {
        // listUsersMini() mengembalikan array: [{id, full_name}]
        const users = await listUsersMini({});
        const map = {};
        (users || []).forEach((u) => (map[u.id] = u.full_name || `Agent #${u.id}`));
        setNameById(map);
      } catch {
        setNameById({});
      }
    })();
  }, []);

  const dash = (v) => (v && String(v).trim() !== "" ? v : "—");

  // ---- Render ----
  return (
    <div className="swap-grid">
      {/* ====== KOLOM KIRI ====== */}
      <div className="swap-col">
        {/* Ajukan Swap */}
        <section className="card fluid">
          <h3 style={{ marginTop: 0 }}>Ajukan Tukar Dinas / Libur</h3>
          <form onSubmit={submitSwap} style={{ display: "grid", gap: 12 }}>
            <div>
              <label className="label">Pilih Jadwal Saya</label>
              <select
                className="input"
                value={selectedMySchForRequest}
                onChange={(e) => setSelectedMySchForRequest(e.target.value)}
                required
              >
                <option value="">— Pilih salah satu —</option>
                {mySchedules
                  .slice()
                  .sort((a, b) => new Date(a.start_at) - new Date(b.start_at))
                  .map((s) => (
                    <option key={s.id} value={s.id}>
                      #{s.id} • {dayjs(s.start_at).format("DD MMM")}{" "}
                      {dayjs(s.start_at).format("HH:mm")}–
                      {dayjs(s.end_at).format("HH:mm")} ({dash(s.channel)})
                    </option>
                  ))}
              </select>
              <div className="helper">
                Jam selesai: <b>{endDisp}</b>
              </div>
            </div>

            <div>
              <label className="label">Alasan</label>
              <textarea
                className="input"
                rows={3}
                placeholder="Tulis alasan…"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </div>

            {msg && <div className="helper">{msg}</div>}
            <button className="btn" disabled={submitting || !isAgent}>
              {submitting ? "Mengirim..." : "Ajukan"}
            </button>
          </form>
        </section>

        {/* Pengajuan Saya (Pending) */}
        <section className="card fluid">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h3 style={{ margin: 0 }}>Pengajuan Saya (Pending)</h3>
            <button className="btn" style={{ width: 160 }} onClick={loadMyPending}>
              Refresh
            </button>
          </div>
          <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
            {myPending.length === 0 && <div className="helper">Tidak ada pengajuan pending.</div>}
            {myPending.map((sw) => (
              <div
                key={sw.id}
                style={{
                  border: "1px solid #E5E7EB",
                  borderRadius: 12,
                  padding: 12,
                  display: "grid",
                  gap: 6,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <b>Swap #{sw.id}</b>{" "}
                    <span className="helper">• Channel: {dash(sw.channel)}</span>
                  </div>
                  <button
                    className="btn"
                    style={{ width: 120, border: "1px solid #E11D48", background: "#fff", color: "#E11D48" }}
                    onClick={() => cancelMySwap(sw)}
                  >
                    Batalkan
                  </button>
                </div>
                <div className="helper">
                  Window: {dayjs(sw.start_at).format("DD MMM YYYY HH:mm")} – {dayjs(sw.end_at).format("HH:mm")}
                </div>
                {sw.reason && <div className="helper">Alasan: {sw.reason}</div>}
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* ====== KOLOM KANAN ====== */}
      <div className="swap-col">
        {/* Permintaan dari Orang Lain (Pending) */}
        <section className="card fluid">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h3 style={{ margin: 0 }}>Permintaan Swap dari Orang Lain (Pending)</h3>
            <button className="btn" style={{ width: 160 }} onClick={loadPendingOthers}>
              Refresh
            </button>
          </div>
          <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
            {pendingOthers.length === 0 && <div className="helper">Tidak ada permintaan.</div>}
            {pendingOthers.map((sw) => {
              // ==== DISPLAY NAME & CHANNEL ====
              const displayName =
                sw.requester_name || nameById[sw.requester_id] || `Agent #${sw.requester_id}`;
              const displayChannel = dash(sw.channel);

              return (
                <div
                  key={sw.id}
                  style={{
                    border: "1px solid #E5E7EB",
                    borderRadius: 12,
                    padding: 12,
                    display: "grid",
                    gap: 6,
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
                    <div>
                      <b>Swap #{sw.id}</b>{" "}
                      <span className="helper">
                        • Pengaju: {displayName} • Channel: {displayChannel}
                      </span>
                    </div>
                    {isAgent && (
                      <div style={{ display: "flex", gap: 8 }}>
                        <button className="btn" style={{ width: 120 }} onClick={() => openAcceptModal(sw)}>
                          Accept
                        </button>
                        <button
                          className="btn"
                          style={{ width: 120, background: "#fff", color: "#6B7280", border: "1px solid #D1D5DB" }}
                          onClick={() =>
                            alert("Tidak bisa menolak permintaan orang lain. Abaikan saja jika tidak ingin menerima.")
                          }
                        >
                          Lewati
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="helper">
                    Window: {dayjs(sw.start_at).format("DD MMM YYYY HH:mm")} – {dayjs(sw.end_at).format("HH:mm")}
                  </div>
                  {sw.reason && <div className="helper">Alasan: {sw.reason}</div>}
                </div>
              );
            })}
          </div>
        </section>

        {/* Jadwal Saya */}
        <section className="card fluid">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h3 style={{ margin: 0 }}>Jadwal Saya</h3>
            <input
              type="month"
              className="input"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              style={{ width: 160, padding: "8px 10px" }}
            />
          </div>
          <table style={{ width: "100%", marginTop: 12, borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ textAlign: "left", fontSize: 13, color: "#6B7280" }}>
                <th style={{ padding: "8px 6px" }}>ID</th>
                <th style={{ padding: "8px 6px" }}>Tanggal</th>
                <th style={{ padding: "8px 6px" }}>Jam</th>
                <th style={{ padding: "8px 6px" }}>Channel</th>
                <th style={{ padding: "8px 6px" }}>Shift/Catatan</th>
              </tr>
            </thead>
            <tbody>
              {mySchedules.map((it) => (
                <tr key={it.id} style={{ borderTop: "1px solid #F3F4F6" }}>
                  <td style={{ padding: "8px 6px" }}>
                    <b>{it.id}</b>
                  </td>
                  <td style={{ padding: "8px 6px" }}>{dayjs(it.start_at).format("DD MMM YYYY")}</td>
                  <td style={{ padding: "8px 6px" }}>
                    {dayjs(it.start_at).format("HH:mm")}–{dayjs(it.end_at).format("HH:mm")}
                  </td>
                  <td style={{ padding: "8px 6px" }}>{dash(it.channel)}</td>
                  <td style={{ padding: "8px 6px" }}>{it.shift_name || it.notes || "-"}</td>
                </tr>
              ))}
              {mySchedules.length === 0 && (
                <tr>
                  <td colSpan={5} className="helper" style={{ padding: "8px 6px" }}>
                    Tidak ada jadwal.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </section>
      </div>

      {/* Modal Accept */}
      {acceptOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,.25)",
            display: "grid",
            placeItems: "center",
            zIndex: 50,
          }}
        >
          <div className="card" style={{ width: 460, maxWidth: 460 }}>
            <h3 style={{ marginTop: 0 }}>Pilih Jadwal untuk Ditukar</h3>
            <div className="helper" style={{ marginBottom: 8 }}>
              Swap #{acceptTarget?.id} • window:{" "}
              {dayjs(acceptTarget?.start_at).format("DD MMM YYYY HH:mm")} –{" "}
              {dayjs(acceptTarget?.end_at).format("HH:mm")}
            </div>

            <label className="label">Pilih Jadwal Saya</label>
            <select
              className="input"
              value={selectedMySchForAccept}
              onChange={(e) => setSelectedMySchForAccept(e.target.value)}
            >
              <option value="">— Pilih salah satu —</option>
              {candidateForAccept
                .slice()
                .sort((a, b) => new Date(a.start_at) - new Date(b.start_at))
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    #{s.id} • {dayjs(s.start_at).format("DD MMM")}{" "}
                    {dayjs(s.start_at).format("HH:mm")}–
                    {dayjs(s.end_at).format("HH:mm")} ({dash(s.channel)})
                  </option>
                ))}
            </select>

            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <button className="btn" style={{ width: 120 }} disabled={!selectedMySchForAccept} onClick={doAccept}>
                Kirim
              </button>
              <button
                className="btn"
                style={{ width: 120, background: "linear-gradient(135deg,#9CA3AF,#6B7280)" }}
                onClick={() => setAcceptOpen(false)}
              >
                Batal
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
