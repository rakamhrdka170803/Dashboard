import React, { useEffect, useState } from "react";
import dayjs from "dayjs";
import { listLeaveRequests, approveLeaveRequest, rejectLeaveRequest } from "../../api/leaveRequests";
import { fileUrl } from "../../api/client"; // ✅

export default function BackofficeLeaves(){
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filterStatus, setFilterStatus] = useState("PENDING");

  const load = async () => {
    setLoading(true);
    try {
      const { items } = await listLeaveRequests({ status: filterStatus || undefined, page:1, size:200 });
      setRows(items || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(()=>{ load(); }, [filterStatus]);

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
      // kalau backend mau, bisa kirim nama asli di field lain; sementara pakai basename
      return base;
    } catch { return "lampiran"; }
  };

  return (
    <div className="card fluid">
      <div className="section-head">
        <h3 className="section-title">Pengajuan Cuti</h3>
        <div className="section-actions" style={{display:"flex", gap:8}}>
          <select className="input" value={filterStatus} onChange={e=>setFilterStatus(e.target.value)}>
            <option value="PENDING">PENDING</option>
            <option value="APPROVED">APPROVED</option>
            <option value="REJECTED">REJECTED</option>
            <option value="">SEMUA</option>
          </select>
          <button className="btn btn-ghost" onClick={load} disabled={loading}>
            {loading ? "Loading..." : "Refresh"}
          </button>
        </div>
      </div>

      <div className="list">
        {rows.length === 0 && <div className="helper">Tidak ada.</div>}
        {rows.map(it=>(
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
            <div className="meta"><span>Tanggal:</span><b>{dayjs(it.start_date).format("DD MMM YYYY")} – {dayjs(it.end_date).format("DD MMM YYYY")}</b></div>
            <div className="meta"><span>Status:</span><b>{it.status}</b></div>
            {it.reason && <div className="meta"><span>Alasan:</span><b>{it.reason}</b></div>}

            {it.file_url && (
              <div className="meta">
                <span>File:</span>
                <a
                  href={fileUrl(it.file_url)}            // ✅ absolute ke API origin
                  target="_blank"
                  rel="noreferrer"
                  download={suggestName(it.file_url)}     // ✅ kasih nama file
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
