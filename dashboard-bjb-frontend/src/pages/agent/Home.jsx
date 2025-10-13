import dayjs from "dayjs";
import { useEffect, useState } from "react";
import { listMonthly } from "../../api/schedules";
import useNotifications from "../../hooks/useNotifications";

export default function AgentHome(){
  const { items: notifs, setRead } = useNotifications();
  const [month, setMonth] = useState(dayjs().format("YYYY-MM"));
  const [upcoming, setUpcoming] = useState([]);

  useEffect(()=>{
    (async ()=>{
      const { items } = await listMonthly({ month });
      const now = dayjs();
      const next7 = items
        .filter(s => dayjs(s.start_at).isAfter(now.subtract(1,"minute")))
        .sort((a,b)=> new Date(a.start_at)-new Date(b.start_at))
        .slice(0,7);
      setUpcoming(next7);
    })();
  }, [month]);

  return (
    <div style={{display:"grid", gap:16}}>
      {/* kartu performa placeholder */}
      <section className="card">
        <h3 style={{marginTop:0}}>Performa Singkat</h3>
        <div className="helper">Coming soon: AHT, FCR, GCR, dsb.</div>
      </section>

      <section className="card">
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <h3 style={{margin:0}}>Jadwal Terdekat</h3>
          <input type="month" className="input" value={month} onChange={(e)=>setMonth(e.target.value)} style={{width:160,padding:"8px 10px"}}/>
        </div>
        <ul style={{margin:12, paddingLeft:18}}>
          {upcoming.length===0 && <li className="helper">Tidak ada jadwal 7 slot ke depan.</li>}
          {upcoming.map(s=>(
            <li key={s.id} style={{marginBottom:6}}>
              <b>{dayjs(s.start_at).format("ddd, DD MMM YYYY")}</b> • {dayjs(s.start_at).format("HH:mm")}–{dayjs(s.end_at).format("HH:mm")} ({s.channel})
              <span style={{marginLeft:6, color:"#6B7280"}}>#{s.id}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="card">
        <h3 style={{marginTop:0}}>Notifikasi</h3>
        <div style={{display:"grid", gap:8}}>
          {notifs.length===0 && <div className="helper">Belum ada notifikasi.</div>}
          {notifs.map(n => (
            <div key={n.id} style={{
              border:"1px solid #E5E7EB", borderRadius:12, padding:12,
              background: n.is_read ? "#fff" : "linear-gradient(135deg,#FFF8E1,#FFF)"
            }}>
              <div style={{fontWeight:700}}>{n.title}</div>
              <div className="helper">{n.body}</div>
              {!n.is_read && (
                <button className="btn" style={{width:120, marginTop:8}} onClick={()=>setRead(n.id)}>
                  Tandai dibaca
                </button>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
