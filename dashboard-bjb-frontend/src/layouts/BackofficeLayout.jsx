import { Outlet } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import Topbar from "../components/Topbar";
import useNotifications from "../hooks/useNotifications";

export default function BackofficeLayout() {
  const { unreadCount } = useNotifications();

  const items = [
    { label:"Home", to:"/backoffice", end:true, badge:"unread" },
    { label:"Jadwal Pribadi", to:"/backoffice/schedule" },
    { label:"Jadwal Semua", to:"/backoffice/schedules" },
    { label:"Tukar Libur", to:"/backoffice/holiday-swaps" },
    { label:"Pengajuan Cuti", to:"/backoffice/leaves" },
    { label:"Finding", to:"/backoffice/findings" },
    { label:"CWC Harian", to:"/backoffice/cwc-input" },        // ⬅️ NEW
    { label:"CWC Analytics", to:"/backoffice/cwc-analytics" },
  ];

  return (
    <div style={{display:"grid", gridTemplateColumns:"260px 1fr", minHeight:"100vh"}}>
      <Sidebar items={items} unreadBadge={unreadCount}/>
      <div style={{display:"grid", gridTemplateRows:"64px 1fr"}}>
        <Topbar title="Backoffice Dashboard" />
        <main style={{padding:16, background:"#F4F6F8"}}><Outlet/></main>
      </div>
    </div>
  );
}
