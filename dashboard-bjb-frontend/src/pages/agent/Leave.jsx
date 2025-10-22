import React, { useEffect, useMemo, useState } from "react";
import dayjs from "dayjs";
import { createLeaveRequest, listLeaveRequests, cancelLeaveRequest } from "../../api/leaveRequests"; // ✅
import { getMyFindingCount } from "../../api/findings";
import { fileUrl } from "../../api/client"; // ✅

export default function AgentLeave() {
  const [startDate, setStartDate] = useState(dayjs().format("YYYY-MM-DD"));
  const [endDate, setEndDate] = useState(dayjs().format("YYYY-MM-DD"));
  const [reason, setReason] = useState("");
  const [file, setFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const [myLeaves, setMyLeaves] = useState([]);
  const [findCount, setFindCount] = useState(0);

  const monthForBlock = useMemo(
    () => dayjs(startDate || undefined).format("YYYY-MM"),
    [startDate]
  );

  const loadMine = async () => {
    const { items } = await listLeaveRequests({ page: 1, size: 100 });
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

  return (
    <div className="vstack-16">
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
            <button className="btn" disabled={submitting || blocked}>{submitting ? "Mengirim..." : "Kirim Pengajuan"}</button>
          </div>
        </form>
      </section>

      <section className="card fluid">
        <div className="section-head">
          <h3 className="section-title">Pengajuan Cuti Saya</h3>
          <div className="section-actions"><button className="btn btn-ghost" onClick={loadMine}>Refresh</button></div>
        </div>
        <div className="list">
          {myLeaves.length === 0 && <div className="helper">Tidak ada.</div>}
          {myLeaves.map(it=>(
            <div key={it.id} className="swap-item">
              <div className="swap-item__top">
                <div className="title-row"><b>Leave #{it.id}</b></div>
                {it.status === "PENDING" && (
                  <div className="actions">
                    <button className="btn btn-secondary" onClick={()=>onCancel(it.id)}>Batalkan</button>
                  </div>
                )}
              </div>
              <div className="meta"><span>Tanggal:</span><b>{dayjs(it.start_date).format("DD MMM YYYY")} – {dayjs(it.end_date).format("DD MMM YYYY")}</b></div>
              <div className="meta"><span>Status:</span><b>{it.status}</b></div>
              {it.file_url && (
                <div className="meta">
                  <span>File:</span>
                  <a
                    href={fileUrl(it.file_url)}     // ✅ absolute ke API
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
