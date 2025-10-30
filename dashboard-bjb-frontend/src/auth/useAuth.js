import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

/** ------- storage helpers ------- */
export function readUser() {
  try {
    return JSON.parse(
      sessionStorage.getItem("user") || localStorage.getItem("user") || "null"
    );
  } catch {
    return null;
  }
}

export function setStoredUser(u, persist = false) {
  const json = JSON.stringify(u || null);
  sessionStorage.setItem("user", json);
  if (persist) localStorage.setItem("user", json);
  window.dispatchEvent(new Event("auth:user-changed"));
}

export function clearAuth() {
  sessionStorage.removeItem("token");
  sessionStorage.removeItem("user");
  localStorage.removeItem("token");
  localStorage.removeItem("user");
  window.dispatchEvent(new Event("auth:user-changed"));
}

/** ------- hook utama (ringan & stabil) ------- */
export default function useAuth() {
  const navigate = useNavigate();
  const [user, setUser] = useState(() => readUser());

  useEffect(() => {
    const update = () => setUser(readUser());
    window.addEventListener("auth:user-changed", update);
    // "storage" hanya terpanggil cross-tab; tetap boleh dipasang
    window.addEventListener("storage", (e) => {
      if (e.key === "user") update();
    });
    return () => {
      window.removeEventListener("auth:user-changed", update);
    };
  }, []);

  function logout() {
    clearAuth();
    navigate("/login", { replace: true });
  }

  return { user, logout };
}
