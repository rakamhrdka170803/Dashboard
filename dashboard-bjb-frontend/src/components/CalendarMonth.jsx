import dayjs from "dayjs";
import "dayjs/locale/id";
dayjs.locale("id");

/**
 * props:
 * - monthStr: "YYYY-MM"
 * - items: array schedule => { id,user_id,start_at,end_at,channel,shift_name,notes, userName? }
 * - renderItem?: (item) => ReactNode   (opsional custom render)
 * - headerExtra?: ReactNode             (opsional konten di header kanan)
 */
export default function CalendarMonth({ monthStr, items = [], renderItem, headerExtra, onDayClick }) {
  const month = dayjs(monthStr + "-01");
  const start = month.startOf("month").startOf("week"); // minggu
  const end = month.endOf("month").endOf("week");
  const days = [];
  let d = start.clone();
  while (d.isBefore(end) || d.isSame(end, "day")) {
    days.push(d);
    d = d.add(1, "day");
  }
  const grouped = groupByDay(items);

  return (
    <div style={{ padding: 16 }}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
        <h2 style={{margin:0}}>{month.format("MMMM YYYY")}</h2>
        <div>{headerExtra}</div>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:6}}>
        {["Min","Sen","Sel","Rab","Kam","Jum","Sab"].map((w)=>(
          <div key={w} style={{fontWeight:700, fontSize:12, color:"#6B7280", padding:"6px 4px"}}>{w}</div>
        ))}
        {days.map((day)=>{
          const inMonth = day.month()===month.month();
          const key = day.format("YYYY-MM-DD");
          const todays = grouped[key] || [];
          return (
            <div key={key} style={{
              background:"#fff", borderRadius:12, padding:8, minHeight:110,
              border: inMonth ? "1px solid #E5E7EB" : "1px dashed #F3F4F6",
              opacity: inMonth ? 1 : .55,
              cursor: onDayClick ? "pointer" : "default"
             }}
             onClick={() => onDayClick && onDayClick(day)}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
                <div style={{fontWeight:700, fontSize:13}}>{day.date()}</div>
                {!inMonth && <span style={{fontSize:10,color:"#9CA3AF"}}>off</span>}
              </div>

              <div style={{display:"grid",gap:6}}>
                {todays.length===0 && <div style={{fontSize:12,color:"#9CA3AF"}}>—</div>}
                {todays.map((it)=>(
                  <div key={it.id} style={{
                    borderRadius:10, padding:"6px 8px",
                    background:"linear-gradient(135deg, rgba(0,84,166,.1), rgba(0,84,166,.08))",
                    border:"1px solid rgba(0,84,166,.25)"
                  }}>
                    {renderItem ? renderItem(it) : (
                      <div style={{fontSize:12}}>
                        <div style={{fontWeight:700}}>
                          {dayjs(it.start_at).format("HH:mm")}–{dayjs(it.end_at).format("HH:mm")} <span style={{fontWeight:500}}>({it.channel})</span>
                        </div>
                        {it.userName && <div style={{color:"#0B1F3B"}}>{it.userName}</div>}
                        {it.shift_name && <div style={{color:"#6B7280"}}>{it.shift_name}</div>}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  );
}

function groupByDay(items){
  const map = {};
  for(const it of items){
    const k = dayjs(it.start_at).format("YYYY-MM-DD");
    (map[k] ||= []).push(it);
  }
  return map;
}
