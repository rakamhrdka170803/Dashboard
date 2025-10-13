import { useEffect, useMemo, useState } from "react";
import dayjs from "dayjs";
import { createSwap, listSwaps, acceptSwap, cancelSwap } from "../../api/swaps";
import { listMonthly } from "../../api/schedules";
import { useAuth } from "../../context/AuthProvider";

export default function AgentSwap() {
  const { user } = useAuth();
  const isAgent = (user?.roles || []).includes("AGENT");

  // data saya
  const [month, setMonth] = useState(dayjs().format("YYYY-MM"));
  const [mySchedules, setMySchedules] = useState([]);

  // form Ajukan → pilih dari jadwal sendiri
  const [selectedMySchForRequest, setSelectedMySchForRequest] = useState("");
  const selectedSch = useMemo(
    () => mySchedules.find((s) => String(s.id) === String(selectedMySchForRequest)),
    [selectedMySchForRequest, mySchedules]
  );
  const endDisp = selectedSch ? dayjs(selectedSch.end_at).format("HH:mm") : "--:--";
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState("");

  // pending swap orang lain
  const [pendingSwaps, setPendingSwaps] = useState([]);

  // modal accept
  const [acceptOpen, setAcceptOpen] = useState(false);
  const [acceptTarget, setAcceptTarget] = useState(null);
  const [selectedMySchForAccept, setSelectedMySchForAccept] = useState("");

  const loadMySchedules = async () => {
    const { items } = await listMonthly({ month });
    setMySchedules(items || []);
  };
  const loadPending = async () => {
    const { items } = await listSwaps({ page: 1, size: 50 });
    const mine = user?.id;
    const rows = (items || []).filter((it) => it.status === "PENDING" && it.requester_id !== mine);
    setPendingSwaps(rows);
  };

  useEffect(() => { loadMySchedules(); }, [month]);
  useEffect(() => { loadPending(); }, []);

  const submitSwap = async (e) => {
    e.preventDefault();
    if (!selectedSch) { setMsg("Pilih salah satu jadwal Anda."); return; }
    setSubmitting(true); setMsg("");
    try {
      await createSwap({ start_at: dayjs(selectedSch.start_at).toISOString(), reason: reason.trim() });
      setMsg("Swap berhasil diajukan. Menunggu agent lain meng-accept.");
      setReason(""); setSelectedMySchForRequest("");
      await loadPending();
    } catch (err) {
      setMsg(err?.response?.data?.error || "Gagal mengajukan swap.");
    } finally { setSubmitting(false); }
  };

  const openAcceptModal = (swap) => {
    setAcceptTarget(swap);
    setSelectedMySchForAccept("");
    setAcceptOpen(true);
  };

  // Pilihan jadwal saya: semua kecuali yang sama persis dengan window pengaju (rule kamu)
  const candidateForAccept = useMemo(() => {
    if (!acceptTarget) return [];
    return (mySchedules || []).filter(
      (s) => !(dayjs(s.start_at).isSame(acceptTarget.start_at) && dayjs(s.end_at).isSame(acceptTarget.end_at))
    );
  }, [acceptTarget, mySchedules]);

  const doAccept = async () => {
    if (!acceptTarget || !selectedMySchForAccept) return;
    try {
      await acceptSwap({ swapId: acceptTarget.id, counterparty_schedule_id: Number(selectedMySchForAccept) });
      setAcceptOpen(false);
      await loadPending();
      await loadMySchedules();
      alert("Swap di-accept. Jadwal telah diperbarui.");
    } catch (err) {
      alert(err?.response?.data?.error || "Gagal accept swap.");
    }
  };

  const onCancel = async (swap) => {
    if (!confirm("Batalkan permintaan ini?")) return;
    try { await cancelSwap({ swapId: swap.id }); await loadPending(); }
    catch (err) { alert(err?.response?.data?.error || "Gagal membatalkan."); }
  };

  return (
    <div style={{ padding: 16, display: "grid", gap: 24 }}>
      {!isAgent && (
        <div className="card" style={{ background: "#FFFBEA" }}>
          <b>Hanya agent yang dapat menggunakan halaman ini.</b> Silakan login sebagai Agent.
        </div>
      )}

      {/* Ajukan Swap */}
      <section className="card">
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
                    #{s.id} • {dayjs(s.start_at).format("DD MMM")} {dayjs(s.start_at).format("HH:mm")}–
                    {dayjs(s.end_at).format("HH:mm")} ({s.channel})
                  </option>
                ))}
            </select>
            <div className="helper">Jam selesai: <b>{endDisp}</b></div>
          </div>

          <div>
            <label className="label">Alasan</label>
            <textarea className="input" rows={3} placeholder="Tulis alasan…" value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>

          {msg && <div className="helper">{msg}</div>}
          <button className="btn" disabled={submitting || !isAgent}>
            {submitting ? "Mengirim..." : "Ajukan"}
          </button>
        </form>
      </section>

      {/* Pending dari orang lain */}
      <section className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3 style={{ margin: 0 }}>Permintaan Swap dari Orang Lain (Pending)</h3>
          <button className="btn" style={{ width: 160 }} onClick={loadPending}>Refresh</button>
        </div>
        <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
          {pendingSwaps.length === 0 && <div className="helper">Tidak ada permintaan.</div>}
          {pendingSwaps.map((sw) => (
            <div key={sw.id} style={{ border: "1px solid #E5E7EB", borderRadius: 12, padding: 12, display: "grid", gap: 6 }}>
              <div><b>Swap #{sw.id}</b> • Pengaju: Agent #{sw.requester_id}</div>
              <div className="helper">
                Window: {dayjs(sw.start_at).format("DD MMM YYYY HH:mm")} – {dayjs(sw.end_at).format("HH:mm")}
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                {isAgent && <button className="btn" style={{ width: 140 }} onClick={() => openAcceptModal(sw)}>Accept</button>}
                <button className="btn" style={{ width: 140, background: "linear-gradient(135deg,#9CA3AF,#6B7280)" }} onClick={() => onCancel(sw)}>Tolak</button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Jadwal Saya */}
      <section className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3 style={{ margin: 0 }}>Jadwal Saya</h3>
          <input type="month" className="input" value={month} onChange={(e) => setMonth(e.target.value)} style={{ width: 160, padding: "8px 10px" }} />
        </div>
        <table style={{ width: "100%", marginTop: 12, borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ textAlign: "left", fontSize: 13, color: "#6B7280" }}>
              <th style={{ padding: "8px 6px" }}>ID</th>
              <th style={{ padding: "8px 6px" }}>Tanggal</th>
              <th style={{ padding: "8px 6px" }}>Jam</th>
              <th style={{ padding: "8px 6px" }}>Channel</th>
              <th style={{ padding: "8px 6px" }}>Catatan</th>
            </tr>
          </thead>
          <tbody>
            {mySchedules.map((it) => (
              <tr key={it.id} style={{ borderTop: "1px solid #F3F4F6" }}>
                <td style={{ padding: "8px 6px" }}><b>{it.id}</b></td>
                <td style={{ padding: "8px 6px" }}>{dayjs(it.start_at).format("DD MMM YYYY")}</td>
                <td style={{ padding: "8px 6px" }}>{dayjs(it.start_at).format("HH:mm")}–{dayjs(it.end_at).format("HH:mm")}</td>
                <td style={{ padding: "8px 6px" }}>{it.channel}</td>
                <td style={{ padding: "8px 6px" }}>{it.shift_name || "-"}</td>
              </tr>
            ))}
            {mySchedules.length === 0 && (
              <tr><td colSpan={5} className="helper" style={{ padding: "8px 6px" }}>Tidak ada jadwal.</td></tr>
            )}
          </tbody>
        </table>
      </section>

      {/* Modal Accept */}
      {acceptOpen && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.2)", display: "grid", placeItems: "center", zIndex: 50 }}>
          <div className="card" style={{ width: 440 }}>
            <h3 style={{ marginTop: 0 }}>Pilih Jadwal untuk Ditukar</h3>
            <div className="helper" style={{ marginBottom: 8 }}>
              Swap #{acceptTarget?.id} • window: {dayjs(acceptTarget?.start_at).format("DD MMM YYYY HH:mm")} – {dayjs(acceptTarget?.end_at).format("HH:mm")}
            </div>

            <label className="label">Pilih Jadwal Saya</label>
            <select className="input" value={selectedMySchForAccept} onChange={(e)=>setSelectedMySchForAccept(e.target.value)}>
              <option value="">— Pilih salah satu —</option>
              {candidateForAccept.map((s) => (
                <option key={s.id} value={s.id}>
                  #{s.id} • {dayjs(s.start_at).format("DD MMM")} {dayjs(s.start_at).format("HH:mm")}–{dayjs(s.end_at).format("HH:mm")} ({s.channel})
                </option>
              ))}
            </select>

            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <button className="btn" style={{ width: 120 }} disabled={!selectedMySchForAccept} onClick={doAccept}>
                Kirim
              </button>
              <button className="btn" style={{ width: 120, background: "linear-gradient(135deg,#9CA3AF,#6B7280)" }} onClick={() => setAcceptOpen(false)}>
                Batal
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
