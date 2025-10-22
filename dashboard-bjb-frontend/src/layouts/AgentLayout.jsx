import { Outlet } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import Topbar from "../components/Topbar";
import useNotifications from "../hooks/useNotifications";

export default function AgentLayout() {
  const { unreadCount } = useNotifications();

  const items = [
    { label:"Home", to:"/agent", end:true },
    { label:"Jadwal", to:"/agent/schedule" },
    { label:"Jadwal (Semua)", to:"/agent/schedules-all" },
    { label:"Pengajuan Tukar", to:"/agent/swap", badge:"unread" },
    { label:"Tukar Libur", to:"/agent/holiday" },
    { label:"Ajukan Cuti", to:"/agent/leave" }, // NEW
  ];

  return (
    <div style={{display:"grid", gridTemplateColumns:"260px 1fr", minHeight:"100vh"}}>
      <Sidebar items={items} unreadBadge={unreadCount}/>
      <div style={{display:"grid", gridTemplateRows:"64px 1fr"}}>
        <Topbar title="Agent Dashboard" />
        <main style={{padding:16, background:"#F4F6F8"}}><Outlet/></main>
      </div>
    </div>
  );
}
