import { useNavigate } from "react-router-dom";
import useNotifications from "../../hooks/useNotifications";

export default function BackofficeHome(){
  const nav = useNavigate();
  const { items: notifs, setRead } = useNotifications();

  return (
    <div style={{display:"grid", gap:16}}>
      <section className="card">
        <h3 style={{marginTop:0}}>Traffic & KPI (Placeholder)</h3>
        <div className="helper">Coming soon: Daily/Weekly/Monthly traffic voice & sosmed, CWC, Top 5/Bottom 3.</div>
      </section>

      <section className="card">
        <div style={{display:"flex", justifyContent:"space-between", alignItems:"center"}}>
          <h3 style={{margin:0}}>Kalender Jadwal</h3>
          <button className="btn" style={{width:200}} onClick={()=>nav("/backoffice/schedules")}>
            Lihat Kalender Bulanan
          </button>
        </div>
      </section>

      <section className="card">
        <h3 style={{marginTop:0}}>Notifikasi / Pengajuan Masuk</h3>
        <div style={{display:"grid", gap:8}}>
          {notifs.length===0 && <div className="helper">Belum ada notifikasi.</div>}
          {notifs.map(n => (
            <div key={n.id} style={{border:"1px solid #E5E7EB", borderRadius:12, padding:12}}>
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
