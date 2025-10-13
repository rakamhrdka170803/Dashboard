import { useEffect, useState } from "react";
import { listMonthly } from "../../api/schedules";
import CalendarMonth from "../../components/CalendarMonth";
import dayjs from "dayjs";

export default function AgentSchedule(){
  const [month, setMonth] = useState(dayjs().format("YYYY-MM"));
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(()=>{
    let mounted = true;
    (async ()=>{
      setLoading(true);
      try {
        const { items } = await listMonthly({ month }); // Agent otomatis dibatasi oleh BE ke miliknya
        setItems(items);
      } finally { if (mounted) setLoading(false); }
    })();
    return ()=>{ mounted=false };
  }, [month]);

  const header = (
    <input
      type="month" value={month}
      onChange={(e)=>setMonth(e.target.value)}
      className="input" style={{width:160,padding:"8px 10px"}}
    />
  );

  return (
    <div style={{padding:16}}>
      {loading ? <p className="helper">Memuat…</p> :
        <CalendarMonth monthStr={month} items={items} headerExtra={header} />
      }
    </div>
  );
}
