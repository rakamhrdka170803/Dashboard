import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthProvider";

export default function ProtectedRoute({ allowRoles = [] }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;

  if (allowRoles.length) {
    const roles = user.roles || [];
    const allowed = roles.some((r) => allowRoles.includes(r));
    if (!allowed) {
      if (roles.includes("AGENT")) return <Navigate to="/agent" replace />;
      return <Navigate to="/backoffice" replace />;
    }
  }
  return <Outlet />;
}
