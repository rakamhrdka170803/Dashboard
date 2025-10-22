// src/pages/agent/HolidaySwap.jsx
import React, { useEffect, useMemo, useState } from "react";
import dayjs from "dayjs";
import { listUsersMini } from "../../api/users";
import { listMonthly } from "../../api/schedules";
import { useAuth } from "../../context/AuthProvider";
import { getOffDays } from "../../api/schedules";
import {
  createHolidaySwap, listHolidaySwaps,
  acceptHolidaySwap, rejectHolidaySwap, cancelHolidaySwap
} from "../../api/holidaySwaps";

export default function AgentHolidaySwap(){
  const { user } = useAuth();
  const myId = user?.id;
  const [allAgents, setAllAgents] = useState([]);
  const [nameById, setNameById] = useState({});
  const [targetId, setTargetId] = useState("");

  const [month, setMonth] = useState(dayjs().format("YYYY-MM"));
  const [targetSchedules, setTargetSchedules] = useState([]);
  const [offDates, setOffDates] = useState([]); // ["2025-10-12", ...]

  const [selectedOffDate, setSelectedOffDate] = useState("");
  const [reason, setReason] = useState("");

  const [mine, setMine] = useState([]);         // pengajuan saya
  const [incoming, setIncoming] = useState([]); // saya sebagai target

  const loadAgents = async () => {
    const users = await listUsersMini({});
    const filtered = (users || []).filter(u => u.id !== myId);
    setAllAgents(filtered);
    const map = {}; (users || []).forEach(u => map[u.id] = u.full_name || `Agent #${u.id}`);
    setNameById(map);
  };

  const loadTargetSchedules = async () => {
    if (!targetId) { setOffDates([]); return; }
    const { off_dates } = await getOffDays(targetId, month);
    setOffDates(off_dates || []);
  };

  const reloadLists = async () => {
    const { items } = await listHolidaySwaps({ page:1, size:100 });
    setMine(items.filter(it => it.requester_id === myId));
    setIncoming(items.filter(it => it.target_user_id === myId));
  };

  useEffect(()=>{ loadAgents(); reloadLists(); },[]);
  useEffect(()=>{ loadTargetSchedules(); },[targetId, month]);

  const submit = async (e) => {
    e.preventDefault();
    if (!targetId || !selectedOffDate) return;
    await createHolidaySwap({ target_user_id: Number(targetId), off_date: selectedOffDate, reason });
    setReason(""); setSelectedOffDate(""); setTargetId("");
    await reloadLists();
    alert("Tukar libur diajukan. Menunggu persetujuan target.");
  };

  return (
    <div className="swap-grid">
      <div className="swap-col">
        <section className="card fluid">
          <div className="section-head">
            <h3 className="section-title">Ajukan Tukar Libur</h3>
          </div>
          <form onSubmit={submit} className="vstack-12">
            <div>
              <label className="label">Pilih Agent Target</label>
              <select className="input" value={targetId} onChange={e=>setTargetId(e.target.value)} required>
                <option value="">— Pilih agent —</option>
                {allAgents.map(a=>(
                  <option key={a.id} value={a.id}>{nameById[a.id] || `Agent #${a.id}`}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="label">Bulan</label>
              <input type="month" className="input" value={month} onChange={e=>setMonth(e.target.value)} />
              <div className="helper">Tanggal libur target dihitung dari tanggal tanpa jadwal.</div>
            </div>

            <div>
              <label className="label">Pilih Tanggal Libur Target</label>
              <select className="input" value={selectedOffDate} onChange={e=>setSelectedOffDate(e.target.value)} required>
                <option value="">— Pilih tanggal —</option>
                {offDates.map(d=>(
                  <option key={d} value={d}>{dayjs(d).format("DD MMM YYYY")}</option>
                ))}
              </select>
              {targetId && offDates.length === 0 && <div className="helper">Tidak ada tanggal OFF untuk agent ini pada bulan dipilih.</div>}
            </div>

            <div>
              <label className="label">Alasan (opsional)</label>
              <textarea className="input" rows={3} value={reason} onChange={e=>setReason(e.target.value)} />
            </div>

            <div className="actions-right">
              <button className="btn">Ajukan</button>
            </div>
          </form>
        </section>

        <section className="card fluid">
          <div className="section-head">
            <h3 className="section-title">Pengajuan Saya</h3>
            <div className="section-actions"><button className="btn btn-ghost" onClick={reloadLists}>Refresh</button></div>
          </div>
          <div className="list">
            {mine.length === 0 && <div className="helper">Tidak ada.</div>}
            {mine.map(it=>(
              <div key={it.id} className="swap-item">
                <div className="swap-item__top">
                  <div className="title-row"><b>HolidaySwap #{it.id}</b></div>
                  {["PENDING_TARGET","PENDING_BO"].includes(it.status) && (
                    <div className="actions">
                      <button className="btn btn-danger" onClick={()=>cancelHolidaySwap(it.id).then(reloadLists)}>Batalkan</button>
                    </div>
                  )}
                </div>
                <div className="meta"><span>Target:</span><b>{nameById[it.target_user_id] || `Agent #${it.target_user_id}`}</b></div>
                <div className="meta"><span>Tanggal:</span><b>{dayjs(it.off_date).format("DD MMM YYYY")}</b></div>
                <div className="meta"><span>Status:</span><b>{it.status}</b></div>
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="swap-col">
        <section className="card fluid">
          <div className="section-head">
            <h3 className="section-title">Permintaan Tukar Libur (Saya sebagai Target)</h3>
            <div className="section-actions"><button className="btn btn-ghost" onClick={reloadLists}>Refresh</button></div>
          </div>
          <div className="list">
            {incoming.length === 0 && <div className="helper">Tidak ada.</div>}
            {incoming.map(it=>(
              <div key={it.id} className="swap-item">
                <div className="swap-item__top">
                  <div className="title-row"><b>HolidaySwap #{it.id}</b></div>
                  {it.status === "PENDING_TARGET" && (
                    <div className="actions">
                      <button className="btn" onClick={()=>acceptHolidaySwap(it.id).then(reloadLists)}>Terima</button>
                      <button className="btn btn-secondary" onClick={()=>rejectHolidaySwap(it.id).then(reloadLists)}>Tolak</button>
                    </div>
                  )}
                </div>
                <div className="meta"><span>Pengaju:</span><b>{nameById[it.requester_id] || `Agent #${it.requester_id}`}</b></div>
                <div className="meta"><span>Tanggal:</span><b>{dayjs(it.off_date).format("DD MMM YYYY")}</b></div>
                <div className="meta"><span>Status:</span><b>{it.status}</b></div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
