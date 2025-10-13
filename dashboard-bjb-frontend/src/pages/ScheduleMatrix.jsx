import React from "react";
import dayjs from "dayjs";
import "dayjs/locale/id";
dayjs.locale("id");

import { listMonthlyAll } from "../api/schedules";
import { listUsersMini } from "../api/users";

// util warna
const color = {
  VOICE:  { bg: "#DBEAFE", border: "#BFDBFE", text: "#1E3A8A" },
  SOSMED: { bg: "#DCFCE7", border: "#BBF7D0", text: "#065F46" },
  CUTI:   { bg: "#FEE2E2", border: "#FCA5A5", text: "#991B1B" },
  OFF:    { bg: "#FFE4F5", border: "#FBCFE8", text: "#86198F" },
};
const pill = (c) => ({ background:c.bg,border:`1px solid ${c.border}`,color:c.text,borderRadius:999,padding:"2px 8px",fontSize:11 });

const cellStyle = (tag) => ({
  background: color[tag].bg,
  border: `1px solid ${color[tag].border}`,
  color: "#111827",
  borderRadius: 10,
  padding: "6px 8px",
  minWidth: 104,
  textAlign: "center",
  fontSize: 12,
  whiteSpace: "nowrap",
  cursor: "pointer",
});

export default function ScheduleMatrix() {
  const [monthStr, setMonthStr] = React.useState(dayjs().format("YYYY-MM"));
  const [users, setUsers] = React.useState([]);
  const [items, setItems] = React.useState([]);

  // Drawer detail
  const [open, setOpen] = React.useState(false);
  const [detail, setDetail] = React.useState({ user:null, date:null, rows:[] });

 const load = async () => {
    const u = await listUsersMini({});
    const s = await listMonthlyAll({ month: monthStr });

    // bangun daftar user dari schedule (fallback) dengan nama jika tersedia
    const uniq = new Map();
    (s.items || []).forEach(it => {
      const label =
        it.user_full_name || it.userName || it.full_name || `Agent #${it.user_id}`;
      if (!uniq.has(it.user_id)) {
        uniq.set(it.user_id, { id: it.user_id, full_name: label });
      }
    });

    const built = Array.from(uniq.values());
    setUsers(u.length ? u : built);
    setItems(s.items || []);
  };
  
  React.useEffect(() => { load(); }, [monthStr]);

  const month = dayjs(monthStr + "-01");
  const days = Array.from({ length: month.daysInMonth() }, (_, i) => month.date(i + 1));

  // group: user -> date -> rows
  const byUser = {};
  for (const it of items) {
    const k = dayjs(it.start_at).format("YYYY-MM-DD");
    (byUser[it.user_id] ||= {});
    (byUser[it.user_id][k] ||= []).push(it);
  }

  const onCellClick = (user, d, arr) => {
    setDetail({
      user,
      date: d,
      rows: (arr || []).slice().sort((a,b)=> new Date(a.start_at)-new Date(b.start_at)),
    });
    setOpen(true);
  };

  return (
    <div style={{ background:"#fff", borderRadius:16, padding:16, position:"relative" }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
        <h3 style={{ margin:0 }}>Jadwal ({month.format("MMMM YYYY")})</h3>
        <input type="month" value={monthStr} onChange={(e)=>setMonthStr(e.target.value)} />
      </div>

      <div style={{ overflowX:"auto" }}>
        <table style={{ borderCollapse:"separate", borderSpacing:8, width:"100%" }}>
          <thead>
            <tr>
              <th style={{ textAlign:"left", minWidth:240 }}>Nama Agent</th>
              {days.map(d=> <th key={d.format("DD")} style={{ textAlign:"center" }}>{d.format("DD")}</th>)}
            </tr>
          </thead>
          <tbody>
            {users.map(u=>(
              <tr key={u.id}>
                <td style={{ fontWeight:700 }}>{u.full_name || `Agent #${u.id}`}</td>
                {days.map(d=>{
                  const k = d.format("YYYY-MM-DD");
                  const arr = (byUser[u.id] && byUser[u.id][k]) ? byUser[u.id][k] : [];
                  let tag = "OFF", label = "—";
                  if (arr.length > 0) {
                    const e = arr[0];
                    tag = e.channel === "VOICE" ? "VOICE" : (e.channel === "SOSMED" ? "SOSMED" : "OFF");
                    label = `${dayjs(e.start_at).format("HH:mm")}–${dayjs(e.end_at).format("HH:mm")} ${e.channel}`;
                  }
                  return (
                    <td key={k}>
                      <div style={cellStyle(tag)} onClick={()=>onCellClick(u,d,arr)}>{label}</div>
                    </td>
                  );
                })}
              </tr>
            ))}
            {users.length === 0 && (
              <tr><td colSpan={days.length+1} style={{ color:"#9CA3AF", padding:12 }}>Tidak ada data.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop:12, fontSize:12, display:"flex", gap:12, flexWrap:"wrap" }}>
        <span style={pill(color.VOICE)}>VOICE (biru)</span>
        <span style={pill(color.SOSMED)}>SOSMED (hijau)</span>
        <span style={pill(color.CUTI)}>CUTI (merah)</span>
        <span style={pill(color.OFF)}>Libur/Off (pink)</span>
      </div>

      {/* Drawer kanan (rapi) */}
      {open && (
        <div style={{
          position:"fixed", top:0, right:0, height:"100vh", width:420,
          background:"#fff", boxShadow:"-8px 0 24px rgba(0,0,0,.08)",
          borderLeft:"1px solid #E5E7EB", zIndex:80, display:"flex", flexDirection:"column"
        }}>
          <div style={{ padding:14, borderBottom:"1px solid #EEF2F7", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
            <div>
              <div style={{ fontSize:12, color:"#6B7280" }}>{detail.date?.format("dddd, DD MMMM YYYY")}</div>
              <div style={{ fontWeight:800 }}>{detail.user?.full_name || `Agent #${detail.user?.id}`}</div>
            </div>
            <button onClick={()=>setOpen(false)} style={{ border:"none", background:"transparent", fontSize:22, cursor:"pointer" }}>✕</button>
          </div>

          <div style={{ padding:14, display:"grid", gap:10, overflowY:"auto" }}>
            {detail.rows.length === 0 && (
              <div style={{ color:"#9CA3AF" }}>Libur/Off</div>
            )}
            {detail.rows.map(e=>{
              const tag = e.channel === "VOICE" ? color.VOICE : color.SOSMED;
              return (
                <div key={e.id} style={{ border:`1px solid ${tag.border}`, borderRadius:12, padding:12 }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                    <div style={{ fontWeight:700, color:tag.text }}>
                      {dayjs(e.start_at).format("HH:mm")}–{dayjs(e.end_at).format("HH:mm")} • {e.channel}
                    </div>
                    {e.shift_name && <span style={pill(tag)}>Shift: {e.shift_name}</span>}
                  </div>
                  {e.notes && <div style={{ color:"#6B7280", marginTop:6 }}>Catatan: {e.notes}</div>}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
