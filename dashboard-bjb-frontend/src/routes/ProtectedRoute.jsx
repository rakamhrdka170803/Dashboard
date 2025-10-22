import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthProvider";

export default function ProtectedRoute({ allowRoles }) {
  const { user, bootstrapped } = useAuth();
  const location = useLocation();

  // tunggu restore session selesai dulu
  if (!bootstrapped) return null;

  // belum login
  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  // cek role jika dibatasi
  if (Array.isArray(allowRoles) && allowRoles.length > 0) {
    const ok = (user.roles || []).some(r => allowRoles.includes(r));
    if (!ok) return <Navigate to="/landing" replace />;
  }

  return <Outlet />;
}
