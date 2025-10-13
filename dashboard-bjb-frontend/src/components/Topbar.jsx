import { useAuth } from "../context/AuthProvider";

export default function Topbar({ title, right }) {
  const { user, logout } = useAuth();
  return (
    <header style={{
      height:64, background:"#fff", borderBottom:"1px solid #E5E7EB",
      display:"flex", alignItems:"center", justifyContent:"space-between",
      padding:"0 18px", position:"sticky", top:0, zIndex:10
    }}>
      <h1 style={{margin:0, fontSize:20}}>{title}</h1>
      <div style={{display:"flex", alignItems:"center", gap:12}}>
        {right}
        <div style={{textAlign:"right"}}>
          <div style={{fontWeight:700, fontSize:14}}>{user?.name || user?.email}</div>
          <div style={{fontSize:12, color:"#6B7280"}}>{user?.roles?.join(", ")}</div>
        </div>
        <button className="btn" style={{width:96}} onClick={logout}>Logout</button>
      </div>
    </header>
  );
}
