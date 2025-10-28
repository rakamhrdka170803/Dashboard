import React, { useEffect, useMemo, useState } from "react";
import dayjs from "dayjs";
import { listUsersMini } from "../../api/users";
import { getOffDays } from "../../api/schedules";
import {
  createHolidaySwap, listHolidaySwaps,
  acceptHolidaySwap, rejectHolidaySwap, cancelHolidaySwap
} from "../../api/holidaySwaps";
import { useAuth } from "../../context/AuthProvider";
import DateRangePicker from "../../components/DateRangePicker";

const STATUS_COLORS = {
  PENDING_TARGET: "#f59e0b",
  PENDING_BO: "#f59e0b",
  APPROVED: "#10b981",
  REJECTED: "#ef4444",
  CANCELLED: "#6b7280",
};

const Chip = ({ children }) => {
  const color = STATUS_COLORS[String(children).toUpperCase()] || "#6b7280";
  return (
    <span style={{ display:"inline-block", padding:"2px 8px", borderRadius:999, backgroundColor:`${color}22`, color, fontWeight:600, fontSize:12 }}>
      {children}
    </span>
  );
};

export default function AgentHolidaySwap(){
  const { user } = useAuth();
  const myId = user?.id;

  const [allAgents, setAllAgents] = useState([]);
  const [nameById, setNameById] = useState({});
  const [targetId, setTargetId] = useState("");

  const [month, setMonth] = useState(dayjs().format("YYYY-MM"));
  const [offDates, setOffDates] = useState([]);
  const [selectedOffDate, setSelectedOffDate] = useState("");
  const [reason, setReason] = useState("");

  const [mine, setMine] = useState([]);
  const [incoming, setIncoming] = useState([]);

  // NEW: history saya + filter
  const [history, setHistory] = useState([]);
  const [hStatus, setHStatus] = useState("");
  const [hRange, setHRange] = useState({ from:"", to:"" });

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
    const { items } = await listHolidaySwaps({ page:1, size:500 });
    setMine(items.filter(it => it.requester_id === myId));
    setIncoming(items.filter(it => it.target_user_id === myId));
    // history saya = semua item yang melibatkan saya
    setHistory(items.filter(it => it.requester_id === myId || it.target_user_id === myId));
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

  const filteredHistory = useMemo(()=>{
    const { from, to } = hRange;
    return (history||[]).filter(it=>{
      if (hStatus && String(it.status).toUpperCase() !== hStatus.toUpperCase()) return false;
      if (from && dayjs(it.off_date).isBefore(dayjs(from))) return false;
      if (to && dayjs(it.off_date).isAfter(dayjs(to))) return false;
      return true;
    });
  }, [history, hStatus, hRange]);

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
                <div className="meta"><span>Status:</span><b><Chip>{it.status}</Chip></b></div>
                {it.reason && <div className="meta"><span>Alasan:</span><b>{it.reason}</b></div>}
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
                <div className="meta"><span>Status:</span><b><Chip>{it.status}</Chip></b></div>
                {it.reason && <div className="meta"><span>Alasan:</span><b>{it.reason}</b></div>}
              </div>
            ))}
          </div>
        </section>

        {/* NEW: Riwayat saya */}
        <section className="card fluid">
          <div className="section-head" style={{ gap: 8 }}>
            <h3 className="section-title">Riwayat Saya (Tukar Libur)</h3>
            <div className="section-actions" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <select className="input" value={hStatus} onChange={(e)=>setHStatus(e.target.value)} style={{ width: 200 }}>
                <option value="">Status: SEMUA</option>
                <option value="APPROVED">APPROVED</option>
                <option value="REJECTED">REJECTED</option>
                <option value="CANCELLED">CANCELLED</option>
                <option value="PENDING_TARGET">PENDING_TARGET</option>
                <option value="PENDING_BO">PENDING_BO</option>
              </select>

              <DateRangePicker
                value={hRange}
                onChange={setHRange}
                onApply={setHRange}
                placeholder="dd/mm/yyyy – dd/mm/yyyy"
                buttonText="Update"
              />

              <button className="btn btn-secondary" onClick={()=>{ setHStatus(""); setHRange({from:"", to:""}); }}>Reset</button>
              <button className="btn btn-ghost" onClick={reloadLists}>Refresh</button>
            </div>
          </div>

          <div className="list">
            {filteredHistory.length === 0 && <div className="helper">Belum ada riwayat.</div>}
            {filteredHistory.map(it=>(
              <div key={it.id} className="swap-item">
                <div className="swap-item__top">
                  <div className="title-row"><b>HolidaySwap #{it.id}</b></div>
                  <Chip>{it.status}</Chip>
                </div>
                <div className="meta"><span>Peran Saya:</span><b>{it.requester_id === myId ? "Pengaju" : "Target"}</b></div>
                <div className="meta"><span>Tanggal OFF:</span><b>{dayjs(it.off_date).format("DD MMM YYYY")}</b></div>
                <div className="meta"><span>Lawannya:</span><b>{it.requester_id === myId ? (nameById[it.target_user_id] || `Agent #${it.target_user_id}`) : (nameById[it.requester_id] || `Agent #${it.requester_id}`)}</b></div>
                {it.reason && <div className="meta"><span>Alasan:</span><b>{it.reason}</b></div>}
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
