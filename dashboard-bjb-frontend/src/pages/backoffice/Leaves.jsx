import React, { useEffect, useMemo, useState } from "react";
import dayjs from "dayjs";
import { listLeaveRequests, approveLeaveRequest, rejectLeaveRequest } from "../../api/leaveRequests";
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

export default function BackofficeLeaves(){
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filterStatus, setFilterStatus] = useState("PENDING");
  const [range, setRange] = useState({ from: "", to: "" });

  const load = async () => {
    setLoading(true);
    try {
      // jika backend sudah support from/to → kirimkan di query
      const q = { status: filterStatus || undefined, page:1, size:200 };
      if (range.from) q.from = range.from;
      if (range.to) q.to = range.to;
      const { items } = await listLeaveRequests(q);
      setRows(items || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(()=>{ load(); }, [filterStatus, range.from, range.to]);

  const onApprove = async (id) => {
    if (!window.confirm("Setujui pengajuan ini?")) return;
    await approveLeaveRequest(id);
    await load();
    alert("Cuti disetujui. Jadwal pada tanggal tsb dihapus otomatis.");
  };

  const onReject = async (id) => {
    const reason = window.prompt("Alasan penolakan:");
    if (!reason) return;
    await rejectLeaveRequest(id, reason);
    await load();
    alert("Cuti ditolak.");
  };

  const suggestName = (urlPath) => {
    try {
      const base = urlPath.split("/").pop() || "lampiran";
      return base;
    } catch { return "lampiran"; }
  };

  // FE filter fallback (kalau backend belum support from/to — aman dipakai bersamaan)
  const filteredRows = useMemo(() => {
    const { from, to } = range || {};
    return (rows || []).filter((it) => {
      if (filterStatus && String(it.status).toUpperCase() !== filterStatus.toUpperCase()) return false;
      if (from && dayjs(it.start_date).isBefore(dayjs(from))) return false;
      if (to && dayjs(it.start_date).isAfter(dayjs(to))) return false;
      return true;
    });
  }, [rows, filterStatus, range]);

  return (
    <div className="card fluid">
      <div className="section-head">
        <h3 className="section-title">Pengajuan Cuti</h3>
        <div className="section-actions" style={{display:"flex", gap:8, flexWrap:"wrap"}}>
          <select className="input" value={filterStatus} onChange={e=>setFilterStatus(e.target.value)}>
            <option value="PENDING">PENDING</option>
            <option value="APPROVED">APPROVED</option>
            <option value="REJECTED">REJECTED</option>
            <option value="">SEMUA</option>
          </select>

          <DateRangePicker
            value={range}
            onChange={setRange}
            onApply={setRange}
            placeholder="dd/mm/yyyy – dd/mm/yyyy"
            buttonText="Update"
          />

          <button className="btn btn-secondary" onClick={()=>setRange({from:"", to:""})}>
            Reset Tanggal
          </button>
          <button className="btn btn-ghost" onClick={load} disabled={loading}>
            {loading ? "Loading..." : "Refresh"}
          </button>
        </div>
      </div>

      <div className="list">
        {filteredRows.length === 0 && <div className="helper">Tidak ada.</div>}
        {filteredRows.map(it=>(
          <div key={it.id} className="swap-item">
            <div className="swap-item__top">
              <div className="title-row"><b>Leave #{it.id}</b></div>
              {it.status === "PENDING" && (
                <div className="actions">
                  <button className="btn" onClick={()=>onApprove(it.id)}>Approve</button>
                  <button className="btn btn-secondary" onClick={()=>onReject(it.id)}>Reject</button>
                </div>
              )}
            </div>

            <div className="meta"><span>Nama:</span><b>{it.requester_name || `User #${it.requester_id}`}</b></div>
            <div className="meta">
              <span>Tanggal:</span>
              <b>{dayjs(it.start_date).format("DD MMM YYYY")} – {dayjs(it.end_date).format("DD MMM YYYY")}</b>
            </div>
            <div className="meta"><span>Status:</span><b><Chip>{it.status}</Chip></b></div>

            {it.rejection_reason && it.status === "REJECTED" && (
              <div className="meta"><span>Alasan ditolak:</span><b>{it.rejection_reason}</b></div>
            )}

            {it.reason && <div className="meta"><span>Alasan (pemohon):</span><b>{it.reason}</b></div>}

            {it.file_url && (
              <div className="meta">
                <span>File:</span>
                <a
                  href={fileUrl(it.file_url)}
                  target="_blank"
                  rel="noreferrer"
                  download={suggestName(it.file_url)}
                  className="btn btn-ghost"
                  style={{ textDecoration: "none", padding: "4px 10px", display: "inline-block" }}
                  title="Download file pengajuan (PDF/Word)"
                >
                  Download File
                </a>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
