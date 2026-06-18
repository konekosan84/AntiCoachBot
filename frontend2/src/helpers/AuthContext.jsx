import { createContext, useContext, useState, useCallback } from "react";
import api from "../api/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const saved = localStorage.getItem("slotiq-user");
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [token, setToken] = useState(() => localStorage.getItem("slotiq-token") || null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const login = useCallback(async (email, password) => {
    setError("");
    setLoading(true);
    try {
      const { data } = await api.post("/auth/login", { email, password });
      // Write to localStorage SYNCHRONOUSLY before any other API call can fire
      localStorage.setItem("slotiq-token", data.token);
      localStorage.setItem("slotiq-user", JSON.stringify(data.user));
      setToken(data.token);
      setUser(data.user);
      return true;
    } catch (e) {
      const msg = e?.response?.data?.error || "LOGIN_FAILED";
      setError(msg);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("slotiq-token");
    localStorage.removeItem("slotiq-user");
    setToken(null);
    setUser(null);
  }, []);

  // Role helper
  const hasRole = useCallback(
    (...roles) => Boolean(user && roles.includes(user.role)),
    [user]
  );

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        error,
        loading,
        isAuthenticated: Boolean(user && token),
        login,
        logout,
        hasRole,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth() must be used inside <AuthProvider>");
  return ctx;
}
