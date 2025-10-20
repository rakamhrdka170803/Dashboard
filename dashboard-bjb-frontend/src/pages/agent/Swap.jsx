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

  const [nameById, setNameById] = useState({});
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
  const [pendingOthers, setPendingOthers] = useState([]);
  const [myPending, setMyPending] = useState([]);

  // Modal Accept
  const [acceptOpen, setAcceptOpen] = useState(false);
  const [acceptTarget, setAcceptTarget] = useState(null);
  const [selectedMySchForAccept, setSelectedMySchForAccept] = useState("");

  // Loaders
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

  useEffect(() => { loadMySchedules(); }, [month]);
  useEffect(() => { loadPendingOthers(); loadMyPending(); }, [myId]);

  // Actions
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
      });
      setMsg("Swap berhasil diajukan. Menunggu agent lain meng-accept.");
      setReason("");
      setSelectedMySchForRequest("");
      await loadMyPending();
    } catch (err) {
      setMsg(err?.response?.data?.error || "Gagal mengajukan swap.");
    } finally { setSubmitting(false); }
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
      await loadMyPending();
    } catch (err) {
      alert(err?.response?.data?.error || "Gagal membatalkan.");
    }
  };

  // Fallback nama
  useEffect(() => {
    (async () => {
      try {
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

  // Render
  return (
    <div className="swap-grid">
      {/* LEFT */}
      <div className="swap-col">
        {/* Ajukan */}
        <section className="card fluid">
          <div className="section-head">
            <h3 className="section-title">Ajukan Tukar Dinas / Libur</h3>
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
                      #{s.id} • {dayjs(s.start_at).format("DD MMM")} {dayjs(s.start_at).format("HH:mm")}–
                      {dayjs(s.end_at).format("HH:mm")} ({dash(s.channel)})
                    </option>
                  ))}
              </select>
              <div className="helper">Jam selesai: <b>{endDisp}</b></div>
            </div>

            <div>
              <label className="label">Alasan</label>
              <textarea
                className="input" rows={3} placeholder="Tulis alasan…"
                value={reason} onChange={(e) => setReason(e.target.value)}
              />
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
                    <button
                      className="btn btn-danger"
                      onClick={() => cancelMySwap(sw)}
                    >
                      Batalkan
                    </button>
                  </div>
                </div>

                <div className="meta">
                  <span>Window:</span>
                  <b>{dayjs(sw.start_at).format("DD MMM YYYY HH:mm")} – {dayjs(sw.end_at).format("HH:mm")}</b>
                </div>
                {sw.reason && <div className="meta"><span>Alasan:</span><b>{sw.reason}</b></div>}
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
              const displayName = sw.requester_name || nameById[sw.requester_id] || `Agent #${sw.requester_id}`;
              return (
                <div className="swap-item" key={sw.id}>
                  <div className="swap-item__top">
                    <div className="title-row">
                      <b>Swap #{sw.id}</b>
                      <span className="chip">{dash(sw.channel)}</span>
                    </div>

                    {isAgent && (
                      <div className="actions">
                        <button className="btn" onClick={() => openAcceptModal(sw)}>Accept</button>
                        <button
                          className="btn btn-secondary"
                          onClick={() => alert("Lewati saja bila tidak ingin menerima.")}
                        >
                          Lewati
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="meta"><span>Pengaju:</span><b>{displayName}</b></div>
                  <div className="meta">
                    <span>Window:</span>
                    <b>{dayjs(sw.start_at).format("DD MMM YYYY HH:mm")} – {dayjs(sw.end_at).format("HH:mm")}</b>
                  </div>
                  {sw.reason && <div className="meta"><span>Alasan:</span><b>{sw.reason}</b></div>}
                </div>
              );
            })}
          </div>
        </section>

        {/* My Schedules */}
        <section className="card fluid">
          <div className="section-head">
            <h3 className="section-title">Jadwal Saya</h3>
            <div className="section-actions">
              <input
                type="month" className="input" value={month}
                onChange={(e) => setMonth(e.target.value)}
                style={{ width: 170 }}
              />
            </div>
          </div>

          <table className="table">
            <thead>
              <tr>
                <th>ID</th><th>Tanggal</th><th>Jam</th><th>Channel</th><th>Shift/Catatan</th>
              </tr>
            </thead>
            <tbody>
              {mySchedules.map((it) => (
                <tr key={it.id}>
                  <td><b>{it.id}</b></td>
                  <td>{dayjs(it.start_at).format("DD MMM YYYY")}</td>
                  <td>{dayjs(it.start_at).format("HH:mm")}–{dayjs(it.end_at).format("HH:mm")}</td>
                  <td>{dash(it.channel)}</td>
                  <td>{it.shift_name || it.notes || "-"}</td>
                </tr>
              ))}
              {mySchedules.length === 0 && (
                <tr><td colSpan={5} className="helper">Tidak ada jadwal.</td></tr>
              )}
            </tbody>
          </table>
        </section>
      </div>

      {/* Modal */}
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
              {candidateForAccept
                .slice()
                .sort((a, b) => new Date(a.start_at) - new Date(b.start_at))
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    #{s.id} • {dayjs(s.start_at).format("DD MMM")} {dayjs(s.start_at).format("HH:mm")}–
                    {dayjs(s.end_at).format("HH:mm")} ({dash(s.channel)})
                  </option>
                ))}
            </select>

            <div className="actions-right" style={{ marginTop: 12 }}>
              <button className="btn" disabled={!selectedMySchForAccept} onClick={doAccept}>Kirim</button>
              <button className="btn btn-secondary" onClick={() => setAcceptOpen(false)}>Batal</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
