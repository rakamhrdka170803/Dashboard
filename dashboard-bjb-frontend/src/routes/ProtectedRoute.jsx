import React from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthProvider";

export default function ProtectedRoute({ allowRoles }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  // masih cek session → jangan tendang dulu
  if (loading) return null;

  // belum login
  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  // kalau route batasi role
  if (Array.isArray(allowRoles) && allowRoles.length > 0) {
    const has = (user.roles || []).some(r => allowRoles.includes(r));
    if (!has) {
      // tidak punya akses → kirim ke landing sesuai role
      return <Navigate to="/landing" replace />;
    }
  }

  return <Outlet />;
}
