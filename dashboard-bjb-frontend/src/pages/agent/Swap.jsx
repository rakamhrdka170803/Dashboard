import React, { useEffect, useMemo, useState } from "react";
import dayjs from "dayjs";
import { createSwap, listSwaps, acceptSwap, cancelSwap } from "../../api/swaps";
import { listMonthly } from "../../api/schedules";
import { useAuth } from "../../context/AuthProvider";
import { listUsersMini } from "../../api/users";
import DateRangePicker from "../../components/DateRangePicker";

const STATUS_COLORS = {
  PENDING: "#f59e0b",
  APPROVED: "#10b981",
  CANCELLED: "#6b7280",
};

const Chip = ({ children }) => {
  const color = STATUS_COLORS[String(children).toUpperCase()] || "#6b7280";
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 8px",
        borderRadius: 999,
        backgroundColor: `${color}22`,
        color,
        fontWeight: 600,
        fontSize: 12,
      }}
    >
      {children}
    </span>
  );
};

export default function AgentSwap() {
  const { user } = useAuth();
  const isAgent = (user?.roles || []).includes("AGENT");
  const myId = user?.id;

  const [nameById, setNameById] = useState({});
  const [allAgents, setAllAgents] = useState([]);
  const [selectedTargetUserId, setSelectedTargetUserId] = useState("");

  const [pickOpen, setPickOpen] = useState(false);
  const [pickQuery, setPickQuery] = useState("");

  const [month, setMonth] = useState(dayjs().format("YYYY-MM"));
  const [mySchedules, setMySchedules] = useState([]);

  const [selectedMySchForRequest, setSelectedMySchForRequest] = useState("");
  const selectedSch = useMemo(
    () => mySchedules.find((s) => String(s.id) === String(selectedMySchForRequest)),
    [selectedMySchForRequest, mySchedules]
  );
  const endDisp = selectedSch ? dayjs(selectedSch.end_at).format("HH:mm") : "--:--";
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState("");

  const [pendingOthers, setPendingOthers] = useState([]);
  const [myPending, setMyPending] = useState([]);

  const [acceptOpen, setAcceptOpen] = useState(false);
  const [acceptTarget, setAcceptTarget] = useState(null);
  const [selectedMySchForAccept, setSelectedMySchForAccept] = useState("");

  // NEW: History tab
  const [history, setHistory] = useState([]);
  const [hStatus, setHStatus] = useState(""); // ALL
  const [hRange, setHRange] = useState({ from: "", to: "" });

  const loadMySchedules = async () => {
    const { items } = await listMonthly({ month });
    setMySchedules(items || []);
  };

  const loadPendingOthers = async () => {
    const { items } = await listSwaps({ page: 1, size: 200 });
    const rows = (items || []).filter(
      (it) =>
        it.status === "PENDING" &&
        it.requester_id !== myId &&
        (it.target_user_id == null || it.target_user_id === myId)
    );
    setPendingOthers(rows);
  };

  const loadMyPending = async () => {
    const { items } = await listSwaps({ page: 1, size: 200 });
    const rows = (items || []).filter(
      (it) => it.status === "PENDING" && Number(it.requester_id) === Number(myId)
    );
    setMyPending(rows);
  };

  const loadHistory = async () => {
    const { items } = await listSwaps({ page: 1, size: 500 });
    // history pribadi: saya sebagai requester ATAU sebagai counterparty
    const mine = (items || []).filter(
      (it) => it.requester_id === myId || it.counterparty_id === myId
    );
    setHistory(mine);
  };

  const reloadAll = async () => {
    await Promise.all([loadMySchedules(), loadPendingOthers(), loadMyPending(), loadHistory()]);
  };

  useEffect(() => { loadMySchedules(); }, [month]);
  useEffect(() => { loadPendingOthers(); loadMyPending(); loadHistory(); }, [myId]);

  useEffect(() => {
    (async () => {
      try {
        const users = await listUsersMini({});
        setAllAgents((users || []).filter((u) => u.id !== myId));
        const map = {};
        (users || []).forEach((u) => (map[u.id] = u.full_name || `Agent #${u.id}`));
        setNameById(map);
      } catch {
        setAllAgents([]);
        setNameById({});
      }
    })();
  }, [myId]);

  const submitSwap = async (e) => {
    e.preventDefault();
    if (!isAgent) return setMsg("Hanya agent yang dapat mengajukan.");
    if (!selectedSch) return setMsg("Pilih salah satu jadwal Anda.");

    setSubmitting(true);
    setMsg("");
    try {
      await createSwap({
        start_at: dayjs(selectedSch.start_at).toISOString(),
        reason: reason.trim(),
        ...(selectedTargetUserId ? { target_user_id: Number(selectedTargetUserId) } : {}),
      });
      setMsg("Swap berhasil diajukan. Menunggu agent lain meng-accept.");
      setReason("");
      setSelectedMySchForRequest("");
      setSelectedTargetUserId("");
      await Promise.all([loadMyPending(), loadHistory()]);
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
      await Promise.all([loadMyPending(), loadHistory()]);
    } catch (err) {
      alert(err?.response?.data?.error || "Gagal membatalkan.");
    }
  };

  const dash = (v) => (v && String(v).trim() !== "" ? v : "—");

  const filteredAgents = useMemo(() => {
    const q = pickQuery.trim().toLowerCase();
    if (!q) return allAgents;
    return allAgents.filter((a) =>
      (nameById[a.id] || `Agent #${a.id}`).toLowerCase().includes(q)
    );
  }, [pickQuery, allAgents, nameById]);

  // NEW: filter history (status + date on start_at)
  const filteredHistory = useMemo(() => {
    const { from, to } = hRange;
    return (history || []).filter((it) => {
      if (hStatus && String(it.status).toUpperCase() !== hStatus.toUpperCase()) return false;
      if (from && dayjs(it.start_at).isBefore(dayjs(from))) return false;
      if (to && dayjs(it.start_at).isAfter(dayjs(to))) return false;
      return true;
    });
  }, [history, hStatus, hRange]);

  return (
    <div className="swap-grid">
      {/* LEFT */}
      <div className="swap-col">
        {/* Ajukan */}
        <section className="card fluid">
          <div className="section-head">
            <h3 className="section-title">Ajukan Tukar Dinas</h3>
          </div>

          <form onSubmit={submitSwap} className="vstack-12">
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

            <div>
              <label className="label">Arahkan ke Agent (opsional)</label>
              <button
                type="button"
                className="input"
                style={{
                  textAlign: "left",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  cursor: "pointer",
                }}
                onClick={() => {
                  setPickQuery("");
                  setPickOpen(true);
                }}
                title="Klik untuk memilih agent"
              >
                <span>
                  {selectedTargetUserId
                    ? nameById[selectedTargetUserId] || `Agent #${selectedTargetUserId}`
                    : "— Kirim ke semua agent —"}
                </span>
                <span style={{ opacity: 0.6 }}>▼</span>
              </button>
              <div className="helper">
                Jika dipilih, hanya agent tersebut (dan Backoffice) yang menerima permintaan.
              </div>
            </div>

            {msg && <div className="helper">{msg}</div>}
            <div className="actions-right">
              <button className="btn" disabled={submitting || !isAgent}>
                {submitting ? "Mengirim..." : "Ajukan"}
              </button>
            </div>
          </form>
        </section>

        {/* My Pending */}
        <section className="card fluid">
          <div className="section-head">
            <h3 className="section-title">Pengajuan Saya (Pending)</h3>
            <div className="section-actions">
              <button className="btn btn-ghost" onClick={loadMyPending}>Refresh</button>
            </div>
          </div>

          <div className="list">
            {myPending.length === 0 && <div className="helper">Tidak ada pengajuan pending.</div>}
            {myPending.map((sw) => (
              <div className="swap-item" key={sw.id}>
                <div className="swap-item__top">
                  <div className="title-row">
                    <b>Swap #{sw.id}</b>
                    <span className="chip">{dash(sw.channel)}</span>
                  </div>
                  <div className="actions">
                    <button className="btn btn-danger" onClick={() => cancelMySwap(sw)}>
                      Batalkan
                    </button>
                  </div>
                </div>

                {sw.target_user_id && (
                  <div className="meta">
                    <span>Ditujukan ke:</span>
                    <b>{nameById[sw.target_user_id] || `Agent #${sw.target_user_id}`}</b>
                  </div>
                )}
                <div className="meta">
                  <span>Window:</span>
                  <b>
                    {dayjs(sw.start_at).format("DD MMM YYYY HH:mm")} – {dayjs(sw.end_at).format("HH:mm")}
                  </b>
                </div>
                {sw.reason && (
                  <div className="meta">
                    <span>Alasan:</span>
                    <b>{sw.reason}</b>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* RIGHT */}
      <div className="swap-col">
        {/* Others Pending */}
        <section className="card fluid">
          <div className="section-head">
            <h3 className="section-title">Permintaan Swap dari Orang Lain (Pending)</h3>
            <div className="section-actions">
              <button className="btn btn-ghost" onClick={loadPendingOthers}>Refresh</button>
            </div>
          </div>

          <div className="list">
            {pendingOthers.length === 0 && <div className="helper">Tidak ada permintaan.</div>}

            {pendingOthers.map((sw) => {
              const displayName =
                sw.requester_name || nameById[sw.requester_id] || `Agent #${sw.requester_id}`;
              return (
                <div className="swap-item" key={sw.id}>
                  <div className="swap-item__top">
                    <div className="title-row">
                      <b>Swap #{sw.id}</b>
                      <span className="chip">{dash(sw.channel)}</span>
                    </div>

                    {isAgent && (
                      <div className="actions">
                        <button className="btn" onClick={() => openAcceptModal(sw)}>
                          Accept
                        </button>
                        <button
                          className="btn btn-secondary"
                          onClick={() => alert("Lewati saja bila tidak ingin menerima.")}
                        >
                          Lewati
                        </button>
                      </div>
                    )}
                  </div>

                  {sw.target_user_id && (
                    <div className="meta">
                      <span>Ditujukan ke:</span>
                      <b>{nameById[sw.target_user_id] || `Agent #${sw.target_user_id}`}</b>
                    </div>
                  )}
                  <div className="meta">
                    <span>Pengaju:</span>
                    <b>{displayName}</b>
                  </div>
                  <div className="meta">
                    <span>Window:</span>
                    <b>
                      {dayjs(sw.start_at).format("DD MMM YYYY HH:mm")} – {dayjs(sw.end_at).format("HH:mm")}
                    </b>
                  </div>
                  {sw.reason && (
                    <div className="meta">
                      <span>Alasan:</span>
                      <b>{sw.reason}</b>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* NEW: Riwayat Saya */}
        <section className="card fluid">
          <div className="section-head" style={{ gap: 8 }}>
            <h3 className="section-title">Riwayat Saya (Swap Dinas)</h3>
            <div className="section-actions" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <select className="input" value={hStatus} onChange={(e) => setHStatus(e.target.value)} style={{ width: 180 }}>
                <option value="">Status: SEMUA</option>
                <option value="PENDING">PENDING</option>
                <option value="APPROVED">APPROVED</option>
                <option value="CANCELLED">CANCELLED</option>
              </select>

              <DateRangePicker
                value={hRange}
                onChange={setHRange}
                onApply={setHRange}
                placeholder="dd/mm/yyyy – dd/mm/yyyy"
                buttonText="Update"
              />

              <button className="btn btn-secondary" onClick={() => { setHStatus(""); setHRange({from:"", to:""}); }}>
                Reset
              </button>
              <button className="btn btn-ghost" onClick={loadHistory}>Refresh</button>
            </div>
          </div>

          <div className="list">
            {filteredHistory.length === 0 && <div className="helper">Belum ada riwayat.</div>}
            {filteredHistory.map((it) => {
              const otherId = it.requester_id === myId ? it.counterparty_id : it.requester_id;
              return (
                <div key={it.id} className="swap-item">
                  <div className="swap-item__top">
                    <div className="title-row">
                      <b>Swap #{it.id}</b>
                    </div>
                    <Chip>{it.status}</Chip>
                  </div>
                  <div className="meta">
                    <span>Dengan:</span>
                    <b>{otherId ? nameById[otherId] || `Agent #${otherId}` : "—"}</b>
                  </div>
                  <div className="meta">
                    <span>Window:</span>
                    <b>
                      {dayjs(it.start_at).format("DD MMM YYYY HH:mm")} – {dayjs(it.end_at).format("HH:mm")}
                    </b>
                  </div>
                  {it.reason && (
                    <div className="meta">
                      <span>Alasan (pengaju):</span>
                      <b>{it.reason}</b>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      </div>

      {/* Modal Accept */}
      {acceptOpen && (
        <div className="modal-backdrop">
          <div className="card modal">
            <h3 style={{ marginTop: 0 }}>Pilih Jadwal untuk Ditukar</h3>
            <div className="helper" style={{ marginBottom: 8 }}>
              Swap #{acceptTarget?.id} • Window:{" "}
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
              {(candidateForAccept || [])
                .slice()
                .sort((a, b) => new Date(a.start_at) - new Date(b.start_at))
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    #{s.id} • {dayjs(s.start_at).format("DD MMM")} {dayjs(s.start_at).format("HH:mm")}–
                    {dayjs(s.end_at).format("HH:mm")} ({s.channel || "—"})
                  </option>
                ))}
            </select>

            <div className="actions-right" style={{ marginTop: 12 }}>
              <button className="btn" disabled={!selectedMySchForAccept} onClick={doAccept}>
                Kirim
              </button>
              <button className="btn btn-secondary" onClick={() => setAcceptOpen(false)}>
                Batal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Picker Agent */}
      {pickOpen && (
        <div className="modal-backdrop" onClick={() => setPickOpen(false)}>
          <div className="card modal" style={{ width: 520 }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginTop: 0 }}>Pilih Agent Tujuan</h3>
            <input
              className="input"
              placeholder="Cari nama agent…"
              value={pickQuery}
              onChange={(e) => setPickQuery(e.target.value)}
              style={{ marginBottom: 10 }}
            />
            <div
              style={{
                border: "1px solid #E5E7EB",
                borderRadius: 12,
                maxHeight: 360,
                overflowY: "auto",
                padding: 4,
              }}
            >
              <div
                className="picker-item"
                onClick={() => {
                  setSelectedTargetUserId("");
                  setPickOpen(false);
                }}
                style={{ padding: 10, borderRadius: 10, cursor: "pointer" }}
              >
                — Kirim ke semua agent —
              </div>

              {filteredAgents.map((a) => (
                <div
                  key={a.id}
                  className="picker-item"
                  onClick={() => {
                    setSelectedTargetUserId(a.id);
                    setPickOpen(false);
                  }}
                  style={{ padding: 10, borderRadius: 10, cursor: "pointer" }}
                >
                  {nameById[a.id] || `Agent #${a.id}`}
                </div>
              ))}
              {filteredAgents.length === 0 && (
                <div className="helper" style={{ padding: 12 }}>
                  Tidak ada hasil.
                </div>
              )}
            </div>

            <div className="actions-right" style={{ marginTop: 12 }}>
              <button className="btn btn-secondary" onClick={() => setPickOpen(false)}>
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
