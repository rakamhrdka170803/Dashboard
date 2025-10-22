import { createContext, useContext, useEffect, useMemo, useState } from "react";
import api from "../api/client";

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [bootstrapped, setBootstrapped] = useState(false);

  // pulihkan sesi + set Authorization header
  useEffect(() => {
    try {
      const tok = sessionStorage.getItem("token") || localStorage.getItem("token");
      const raw = sessionStorage.getItem("user") || localStorage.getItem("user");
      if (tok) api.defaults.headers.common.Authorization = `Bearer ${tok}`;
      if (raw) setUser(JSON.parse(raw));
    } finally {
      setBootstrapped(true);
    }
  }, []);

  const login = async (arg1, arg2, arg3) => {
    let email, password, remember = false;
    if (typeof arg1 === "object" && arg1 !== null) {
      email = arg1.email; password = arg1.password; remember = !!arg1.remember;
    } else {
      email = arg1; password = arg2; remember = !!arg3;
    }
    const { data } = await api.post("/auth/login", { email, password });
    const token = data?.access_token || data?.token;
    const u = data?.user;
    if (!token) throw new Error("Token tidak ditemukan pada respon login.");

    api.defaults.headers.common.Authorization = `Bearer ${token}`;
    sessionStorage.setItem("token", token);
    sessionStorage.setItem("user", JSON.stringify(u || null));
    if (remember) {
      localStorage.setItem("token", token);
      localStorage.setItem("user", JSON.stringify(u || null));
    }
    setUser(u || null);
    return { user: u || null };
  };

  const logout = () => {
    delete api.defaults.headers.common.Authorization;
    sessionStorage.removeItem("token"); sessionStorage.removeItem("user");
    localStorage.removeItem("token"); localStorage.removeItem("user");
    setUser(null);
    window.location.href = "/login";
  };

  const value = useMemo(() => ({ user, login, logout, bootstrapped }), [user, bootstrapped]);
  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export const useAuth = () => useContext(AuthCtx);
export default AuthProvider;
