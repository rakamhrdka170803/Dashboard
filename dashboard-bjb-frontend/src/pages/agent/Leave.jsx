import React, { useEffect, useMemo, useState } from "react";
import dayjs from "dayjs";
import { createLeaveRequest, listLeaveRequests, cancelLeaveRequest } from "../../api/leaveRequests";
import { getMyFindingCount } from "../../api/findings";
import { fileUrl } from "../../api/client";
import DateRangePicker from "../../components/DateRangePicker";

const STATUS_COLORS = {
  PENDING: "#f59e0b",
  APPROVED: "#10b981",
  REJECTED: "#ef4444",
  CANCELLED: "#6b7280",
};

function Chip({ children }) {
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
}

export default function AgentLeave() {
  const [startDate, setStartDate] = useState(dayjs().format("YYYY-MM-DD"));
  const [endDate, setEndDate] = useState(dayjs().format("YYYY-MM-DD"));
  const [reason, setReason] = useState("");
  const [file, setFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const [myLeaves, setMyLeaves] = useState([]);
  const [findCount, setFindCount] = useState(0);

  // Riwayat filters
  const [hStatus, setHStatus] = useState("");                 // ALL
  const [hRange, setHRange] = useState({ from: "", to: "" }); // {from,to} 'YYYY-MM-DD'

  const monthForBlock = useMemo(
    () => dayjs(startDate || undefined).format("YYYY-MM"),
    [startDate]
  );

  const loadMine = async () => {
    const { items } = await listLeaveRequests({ page: 1, size: 200 });
    setMyLeaves(items || []);
  };

  const loadFindingCount = async () => {
    try {
      const { count } = await getMyFindingCount(monthForBlock);
      setFindCount(count || 0);
    } catch {
      setFindCount(0);
    }
  };

  useEffect(() => { loadMine(); }, []);
  useEffect(() => { loadFindingCount(); }, [monthForBlock]);

  const blocked = findCount >= 5;

  const onSubmit = async (e) => {
    e.preventDefault();
    if (blocked) return;
    if (!startDate || !endDate) return;
    if (dayjs(endDate).isBefore(dayjs(startDate))) {
      alert("Tanggal akhir tidak boleh sebelum tanggal awal");
      return;
    }
    setSubmitting(true);
    try {
      await createLeaveRequest({ start_date: startDate, end_date: endDate, reason, file });
      setReason(""); setFile(null);
      await loadMine();
      alert("Pengajuan cuti terkirim.");
    } catch (err) {
      alert(err?.response?.data?.error || "Gagal mengajukan cuti");
    } finally {
      setSubmitting(false);
    }
  };

  const onCancel = async (id) => {
    if (!window.confirm("Batalkan pengajuan cuti ini?")) return;
    await cancelLeaveRequest(id);
    await loadMine();
    alert("Pengajuan dibatalkan.");
  };

  const suggestName = (urlPath) => {
    try { return urlPath.split("/").pop() || "lampiran"; } catch { return "lampiran"; }
  };

  // FE filter riwayat (status + range by start_date)
  const filteredLeaves = useMemo(() => {
    const { from, to } = hRange || {};
    return (myLeaves || []).filter((it) => {
      if (hStatus && String(it.status).toUpperCase() !== hStatus.toUpperCase()) return false;
      if (from && dayjs(it.start_date).isBefore(dayjs(from))) return false;
      if (to && dayjs(it.start_date).isAfter(dayjs(to))) return false;
      return true;
    });
  }, [myLeaves, hStatus, hRange]);

  return (
    <div className="vstack-16">
      {/* Ajukan Cuti */}
      <section className="card fluid">
        <div className="section-head">
          <h3 className="section-title">Ajukan Cuti</h3>
          <div className="section-actions">
            <span className="badge">{`Finding bulan ini: ${findCount}`}</span>
          </div>
        </div>

        {blocked && (
          <div className="alert alert-warning">
            Finding bulan ini sudah {findCount}. Kamu tidak bisa mengajukan cuti.
          </div>
        )}

        <form onSubmit={onSubmit} className="vstack-12">
          <div className="row" style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:12}}>
            <div>
              <label className="label">Tanggal Mulai</label>
              <input type="date" className="input" value={startDate} onChange={e=>setStartDate(e.target.value)} required />
            </div>
            <div>
              <label className="label">Tanggal Selesai</label>
              <input type="date" className="input" value={endDate} onChange={e=>setEndDate(e.target.value)} required />
            </div>
          </div>

          <div>
            <label className="label">Alasan (opsional)</label>
            <textarea className="input" rows={3} value={reason} onChange={e=>setReason(e.target.value)} />
          </div>

          <div>
            <label className="label">File Pengajuan (PDF/DOC/DOCX)</label>
            <input type="file" className="input" accept=".pdf,.doc,.docx" onChange={e=>setFile(e.target.files?.[0]||null)} />
          </div>

          <div className="actions-right">
            <button className="btn" disabled={submitting || blocked}>
              {submitting ? "Mengirim..." : "Kirim Pengajuan"}
            </button>
          </div>
        </form>
      </section>

      {/* Riwayat Cuti Saya */}
      <section className="card fluid">
        <div className="section-head">
          <h3 className="section-title">Riwayat Cuti Saya</h3>
          <div className="section-actions" style={{display:"flex", gap:8, flexWrap:"wrap"}}>
            <select className="input" value={hStatus} onChange={(e)=>setHStatus(e.target.value)} style={{width:180}}>
              <option value="">Status: SEMUA</option>
              <option value="PENDING">PENDING</option>
              <option value="APPROVED">APPROVED</option>
              <option value="REJECTED">REJECTED</option>
              <option value="CANCELLED">CANCELLED</option>
            </select>

            <DateRangePicker
              value={hRange}
              onChange={setHRange}   // live preview
              onApply={setHRange}    // final apply
              placeholder="dd/mm/yyyy – dd/mm/yyyy"
              buttonText="Update"
            />

            <button className="btn btn-secondary" onClick={()=>{ setHStatus(""); setHRange({from:"", to:""}); }}>
              Reset
            </button>
            <button className="btn btn-ghost" onClick={loadMine}>Refresh</button>
          </div>
        </div>

        <div className="list">
          {filteredLeaves.length === 0 && <div className="helper">Tidak ada.</div>}
          {filteredLeaves.map(it=>(
            <div key={it.id} className="swap-item">
              <div className="swap-item__top">
                <div className="title-row"><b>Leave #{it.id}</b></div>
                {it.status === "PENDING" && (
                  <div className="actions">
                    <button className="btn btn-secondary" onClick={()=>onCancel(it.id)}>Batalkan</button>
                  </div>
                )}
              </div>

              <div className="meta">
                <span>Tanggal:</span>
                <b>{dayjs(it.start_date).format("DD MMM YYYY")} – {dayjs(it.end_date).format("DD MMM YYYY")}</b>
              </div>

              <div className="meta">
                <span>Status:</span>
                <b><Chip>{it.status}</Chip></b>
              </div>

              {it.rejection_reason && it.status === "REJECTED" && (
                <div className="meta"><span>Alasan ditolak:</span><b>{it.rejection_reason}</b></div>
              )}

              {it.file_url && (
                <div className="meta">
                  <span>File:</span>
                  <a
                    href={fileUrl(it.file_url)}
                    target="_blank"
                    rel="noreferrer"
                    download={suggestName(it.file_url)}
                  >
                    Download
                  </a>
                </div>
              )}

              {it.reason && <div className="meta"><span>Alasan:</span><b>{it.reason}</b></div>}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
