import React, { useEffect, useState } from "react";
import dayjs from "dayjs";
import { listHolidaySwaps, boApproveHolidaySwap } from "../../api/holidaySwaps";
import { listUsersMini } from "../../api/users";

export default function BackofficeHolidaySwap(){
  const [rows, setRows] = useState([]);
  const [nameById, setNameById] = useState({});
  const [open, setOpen] = useState(null); // item yang dibuka untuk approve

  const load = async () => {
    const { items } = await listHolidaySwaps({ page:1, size:200 });
    setRows(items || []);
    const users = await listUsersMini({});
    const map = {}; (users||[]).forEach(u => map[u.id] = u.full_name || `Agent #${u.id}`);
    setNameById(map);
  };

  useEffect(()=>{ load(); },[]);

  const pendingBO = rows.filter(r => r.status === "PENDING_BO");

  const submitApprove = async (e) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const start_time = form.get("start_time"); // HH:mm
    const channel = form.get("channel");
    const shift_name = form.get("shift_name") || null;
    const notes = form.get("notes") || null;
    await boApproveHolidaySwap(open.id, { start_time, channel, shift_name, notes });
    setOpen(null);
    await load();
    alert("Tukar libur disetujui & jadwal dibuat.");
  };

  return (
    <div className="card fluid">
      <div className="section-head">
        <h3 className="section-title">Tukar Libur • Pending Backoffice</h3>
        <div className="section-actions">
          <button className="btn btn-ghost" onClick={load}>Refresh</button>
        </div>
      </div>

      <div className="list">
        {pendingBO.length === 0 && <div className="helper">Tidak ada.</div>}
        {pendingBO.map(it=>(
          <div key={it.id} className="swap-item">
            <div className="swap-item__top">
              <div className="title-row"><b>HolidaySwap #{it.id}</b></div>
              <div className="actions">
                <button className="btn" onClick={()=>setOpen(it)}>Approve & Buat Jadwal</button>
              </div>
            </div>
            <div className="meta"><span>Tanggal:</span><b>{dayjs(it.off_date).format("dddd, DD MMM YYYY")}</b></div>
            <div className="meta"><span>Pengaju:</span><b>{nameById[it.requester_id]||`Agent #${it.requester_id}`}</b></div>
            <div className="meta"><span>Target:</span><b>{nameById[it.target_user_id]||`Agent #${it.target_user_id}`}</b></div>
          </div>
        ))}
      </div>

      {open && (
        <div className="modal-backdrop" onClick={()=>setOpen(null)}>
          <div className="card modal" onClick={(e)=>e.stopPropagation()} style={{width:520}}>
            <h3 style={{marginTop:0}}>
              Buat Jadwal untuk {nameById[open.target_user_id] || `Agent #${open.target_user_id}`}
            </h3>
            <div className="helper">
              Tanggal: <b>{dayjs(open.off_date).format("DD MMM YYYY")}</b> — end otomatis +8 jam.
            </div>
            <form onSubmit={submitApprove} className="vstack-12">
              <label className="label">Jam Masuk</label>
              <input type="time" name="start_time" className="input" required defaultValue="09:00" />

              <label className="label">Channel</label>
              <select name="channel" className="input" required defaultValue="VOICE">
                <option value="VOICE">VOICE</option>
                <option value="SOSMED">SOSMED</option>
              </select>

              <input name="shift_name" className="input" placeholder="Shift (opsional)" />
              <input name="notes" className="input" placeholder="Catatan (opsional)" />

              <div className="actions-right">
                <button className="btn">Approve & Create</button>
                <button type="button" className="btn btn-secondary" onClick={()=>setOpen(null)}>Batal</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
