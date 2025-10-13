import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthProvider";

export default function Landing() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;
    if (!user) { navigate("/login", { replace: true }); return; }

    const roles = user.roles || [];
    const isBackoffice = roles.some(r => ["SUPER_ADMIN","SPV","QC","TL","HR_ADMIN"].includes(r));
    if (isBackoffice) navigate("/backoffice", { replace: true });
    else if (roles.includes("AGENT")) navigate("/agent", { replace: true });
    else navigate("/login", { replace: true }); // fallback
  }, [user, loading, navigate]);

  return null; // tidak render apa-apa
}
