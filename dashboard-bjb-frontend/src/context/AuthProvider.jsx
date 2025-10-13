import { createContext, useContext, useEffect, useMemo, useState } from "react";
import api from "../api/client";

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);

  useEffect(() => {
    const raw = sessionStorage.getItem("user") || localStorage.getItem("user");
    if (raw) {
      try { setUser(JSON.parse(raw)); } catch {}
    }
  }, []);

  const login = async (email, password, remember = false) => {
    const { data } = await api.post("/auth/login", { email, password });
    const token = data?.token;
    const u = data?.user;

    sessionStorage.setItem("token", token);
    sessionStorage.setItem("user", JSON.stringify(u));
    if (remember) {
      localStorage.setItem("token", token);
      localStorage.setItem("user", JSON.stringify(u));
    }
    setUser(u);
    return u;
  };

  const logout = () => {
    sessionStorage.removeItem("token");
    sessionStorage.removeItem("user");
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setUser(null);
    window.location.href = "/login";
  };

  const value = useMemo(() => ({ user, login, logout }), [user]);
  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export const useAuth = () => useContext(AuthCtx);

// default export untuk yang import default
export default AuthProvider;
