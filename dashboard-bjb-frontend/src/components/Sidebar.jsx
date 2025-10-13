import { NavLink } from "react-router-dom";

export default function Sidebar({ items, unreadBadge = 0 }) {
  return (
    <aside style={{
      width: 260, background: "#0B1F3B", color: "#E9EEF6",
      display: "flex", flexDirection: "column", padding: "18px 14px"
    }}>
      <div style={{display:"flex", alignItems:"center", gap:10, marginBottom:18}}>
        <div className="logoMark" style={{boxShadow:"none"}} />
        <div style={{fontWeight:800, letterSpacing:.2}}>bank bjb</div>
      </div>

      <nav style={{display:"grid", gap:6}}>
        {items.map(it => (
          <NavLink
            key={it.to}
            to={it.to}
            end={it.end}
            style={({isActive})=>({
              display:"flex", alignItems:"center", justifyContent:"space-between",
              padding:"10px 12px", borderRadius:12, fontWeight:600,
              background: isActive ? "rgba(255,255,255,.12)" : "transparent",
              color:"#E9EEF6"
            })}
          >
            <span>{it.label}</span>
            {it.badge === "unread" && unreadBadge > 0 && (
              <span style={{
                background:"#FFC20E", color:"#0B1F3B", fontSize:12,
                borderRadius:999, padding:"2px 8px", fontWeight:800
              }}>{unreadBadge}</span>
            )}
          </NavLink>
        ))}
      </nav>

      <div style={{marginTop:"auto", fontSize:12, color:"#9FB0C8"}}>© Backoffice Suite</div>
    </aside>
  );
}
