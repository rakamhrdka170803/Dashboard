import dayjs from "dayjs";
import { useEffect, useState } from "react";
import { listMonthly } from "../../api/schedules";
import { listFindings } from "../../api/findings";
import useNotifications from "../../hooks/useNotifications";

export default function AgentHome(){
  const { items: notifs } = useNotifications();
  const [month, setMonth] = useState(dayjs().format("YYYY-MM"));
  const [upcoming, setUpcoming] = useState([]);
  const [findMonth, setFindMonth] = useState(dayjs().format("YYYY-MM"));
  const [findings, setFindings] = useState([]);

  useEffect(()=>{
    (async ()=>{
      const { items } = await listMonthly({ month });
      const now = dayjs();
      const next7 = (items||[])
        .filter(s => dayjs(s.start_at).isAfter(now.subtract(1,"minute")))
        .sort((a,b)=> new Date(a.start_at)-new Date(b.start_at))
        .slice(0,7);
      setUpcoming(next7);
    })();
  }, [month]);

  useEffect(()=>{
    (async ()=>{
      const { items } = await listFindings({ month: findMonth, page:1, size:100 });
      setFindings(items || []);
    })();
  }, [findMonth]);

  return (
    <div style={{display:"grid", gap:16}}>
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
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <h3 style={{margin:0}}>Finding Saya (Per Bulan)</h3>
          <div style={{display:"flex", gap:8, alignItems:"center"}}>
            <input type="month" className="input" value={findMonth} onChange={(e)=>setFindMonth(e.target.value)} />
            <span className="badge">Total: {findings.length}</span>
          </div>
        </div>
        <div className="list" style={{marginTop:10}}>
          {findings.length===0 && <div className="helper">Tidak ada finding pada bulan ini.</div>}
          {findings.map(it=>{
            let cat = "—", desc = it.description || "";
            const m = /^\s*\[([^\]]+)\]\s*/.exec(desc);
            if (m) { cat = m[1]; desc = desc.replace(m[0], ""); }
            return (
              <div key={it.id} className="swap-item">
                <div className="meta"><span>Tanggal:</span><b>{dayjs(it.issued_at).format("DD MMM YYYY")}</b></div>
                <div className="meta"><span>Kategori:</span><b>{cat}</b></div>
                {desc && <div className="meta"><span>Catatan:</span><b>{desc}</b></div>}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
