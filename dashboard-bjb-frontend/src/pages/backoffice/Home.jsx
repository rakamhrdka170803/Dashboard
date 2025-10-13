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
    </div>
  );
}
