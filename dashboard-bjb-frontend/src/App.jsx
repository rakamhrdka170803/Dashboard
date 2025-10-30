import { Routes, Route, Navigate } from "react-router-dom";
import ProtectedRoute from "./routes/ProtectedRoute";
import Login from "./pages/Login";

import ProfilePage from "./pages/Profile";
import AgentLayout from "./layouts/AgentLayout";
import BackofficeLayout from "./layouts/BackofficeLayout";

import AgentHome from "./pages/agent/Home";
import AgentSchedule from "./pages/agent/Schedule";
import AgentSwap from "./pages/agent/Swap";
import AgentHolidaySwap from "./pages/agent/HolidaySwap";
import AgentLeave from "./pages/agent/Leave";                // NEW
import BackofficeSwaps from "./pages/backoffice/Swaps"; 
import BackofficeLeaves from "./pages/backoffice/Leaves";    // NEW
import BackofficeFindings from "./pages/backoffice/Findings";

import BackofficeHome from "./pages/backoffice/Home";
import BackofficeSchedules from "./pages/backoffice/Schedules";
import ScheduleMatrix from "./pages/ScheduleMatrix";
import Landing from "./pages/Landing";

const BACKOFFICE_ROLES = ["SUPER_ADMIN","SPV","QC","TL","HR_ADMIN"];

export default function App(){
  return (
    <Routes>
      <Route path="/login" element={<Login/>} />
      <Route path="/landing" element={<Landing/>} />
      <Route path="/" element={<Navigate to="/landing" replace />} />

      {/* BACKOFFICE */}
      <Route element={<ProtectedRoute allowRoles={BACKOFFICE_ROLES} />}>
        <Route element={<BackofficeLayout/>}>
          <Route index element={<BackofficeHome/>} />
          <Route path="/backoffice" element={<BackofficeHome/>} />
          <Route path="/backoffice/profile" element={<ProfilePage/>} />
          <Route path="/backoffice/schedule" element={<BackofficeSchedules/>} />
          <Route path="/backoffice/schedules" element={<ScheduleMatrix/>} />
          <Route path="/backoffice/holiday-swaps" element={<BackofficeSwaps/>} />
          <Route path="/backoffice/leaves" element={<BackofficeLeaves/>} /> {/* NEW */}
          <Route path="/backoffice/findings" element={<BackofficeFindings/>} />
        </Route>
      </Route>

      {/* AGENT */}
      <Route element={<ProtectedRoute allowRoles={["AGENT"]} />}>
        <Route element={<AgentLayout/>}>
          <Route index element={<AgentHome/>} />
          <Route path="/agent" element={<AgentHome/>} />
          <Route path="/agent/profile" element={<ProfilePage/>} />
          <Route path="/agent/schedule" element={<AgentSchedule/>} />
          <Route path="/agent/swap" element={<AgentSwap/>} />
          <Route path="/agent/holiday" element={<AgentHolidaySwap/>} />
          <Route path="/agent/leave" element={<AgentLeave/>} />          {/* NEW */}
          <Route path="/agent/schedules-all" element={<ScheduleMatrix/>} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/landing" replace/>} />
    </Routes>
  );
}
