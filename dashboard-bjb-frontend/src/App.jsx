import { Routes, Route, Navigate } from "react-router-dom";
import ProtectedRoute from "./routes/ProtectedRoute";
import Login from "./pages/Login";

import AgentLayout from "./layouts/AgentLayout";
import BackofficeLayout from "./layouts/BackofficeLayout";

import AgentHome from "./pages/agent/Home";
import AgentSchedule from "./pages/agent/Schedule";
import AgentSwap from "./pages/agent/Swap";

import BackofficeHome from "./pages/backoffice/Home";
import BackofficeSchedules from "./pages/backoffice/Schedules";

const BACKOFFICE_ROLES = ["SUPER_ADMIN","SPV","QC","TL","HR_ADMIN"];

export default function App(){
  return (
    <Routes>
      <Route path="/login" element={<Login/>} />

      <Route element={<ProtectedRoute allowRoles={BACKOFFICE_ROLES} />}>
        <Route element={<BackofficeLayout/>}>
          <Route index path="/backoffice" element={<BackofficeHome/>} />
          <Route path="/backoffice/schedules" element={<BackofficeSchedules/>} />
        </Route>
      </Route>

      <Route element={<ProtectedRoute allowRoles={["AGENT"]} />}>
        <Route element={<AgentLayout/>}>
          <Route index path="/agent" element={<AgentHome/>} />
          <Route path="/agent/schedule" element={<AgentSchedule/>} />
          <Route path="/agent/swap" element={<AgentSwap/>} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/login" replace/>} />
    </Routes>
  );
}
