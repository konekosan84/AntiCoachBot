/**
 * Client-side auth (for /booking and /me — end customer accounts).
 * Distinct from admin AuthContext.
 *
 * Token stored under `slotiq-client-token` in localStorage.
 */
import { createContext, useContext, useState, useCallback, useEffect } from "react";

const ClientAuthContext = createContext(null);

const API = "http://localhost:4000";

async function api(path, opts = {}) {
  const token = localStorage.getItem("slotiq-client-token");
  const res = await fetch(API + path, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(opts.headers || {}),
    },
  });
  let data = null;
  try { data = await res.json(); } catch {}
  if (!res.ok) {
    const err = new Error(data?.error || `HTTP_${res.status}`);
    err.status = res.status;
    err.payload = data;
    throw err;
  }
  return data;
}

export function ClientAuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem("slotiq-client-token") || null);
  const [client, setClient] = useState(() => {
    try { return JSON.parse(localStorage.getItem("slotiq-client") || "null"); } catch { return null; }
  });

  // Hydrate client info from server if we have token but no client
  useEffect(() => {
    if (token && !client) {
      api("/api/v1/client-auth/me")
        .then(d => { if (d.client) saveClient(d.client); })
        .catch(() => clearAll());
    }
  }, [token]);

  const saveClient = (c) => {
    setClient(c);
    if (c) localStorage.setItem("slotiq-client", JSON.stringify(c));
    else localStorage.removeItem("slotiq-client");
  };

  const saveToken = (t) => {
    setToken(t);
    if (t) localStorage.setItem("slotiq-client-token", t);
    else localStorage.removeItem("slotiq-client-token");
  };

  const clearAll = () => { saveToken(null); saveClient(null); };

  const lookup = useCallback((phone) => api("/api/v1/client-auth/lookup", {
    method: "POST", body: JSON.stringify({ phone }),
  }), []);

  const sendCode = useCallback((phone) => api("/api/v1/client-auth/send-code", {
    method: "POST", body: JSON.stringify({ phone }),
  }), []);

  const verify = useCallback(async (phone, code, full_name) => {
    const d = await api("/api/v1/client-auth/verify", {
      method: "POST",
      body: JSON.stringify({ phone, code, full_name }),
    });
    saveToken(d.token);
    saveClient(d.client);
    return d;
  }, []);

  const logout = useCallback(async () => {
    try { await api("/api/v1/client-auth/logout", { method: "POST" }); } catch {}
    clearAll();
  }, []);

  const refreshMe = useCallback(async () => {
    const d = await api("/api/v1/client-auth/me");
    if (d.client) saveClient(d.client);
    return d.client;
  }, []);

  const updateMe = useCallback(async (patch) => {
    await api("/api/v1/client-auth/me", { method: "PATCH", body: JSON.stringify(patch) });
    return refreshMe();
  }, [refreshMe]);

  const myBookings = useCallback(() => api("/api/v1/client-auth/bookings"), []);

  const cancelBooking = useCallback((id) => api(`/api/v1/client-auth/bookings/${id}/cancel`, { method: "POST" }), []);

  const rescheduleBooking = useCallback((id, payload) => api(`/api/v1/client-auth/bookings/${id}`, {
    method: "PATCH", body: JSON.stringify(payload),
  }), []);

  const bookAuthenticated = useCallback((payload) => api("/api/v1/client-auth/book", {
    method: "POST", body: JSON.stringify(payload),
  }), []);

  return (
    <ClientAuthContext.Provider value={{
      token, client,
      isLoggedIn: !!token && !!client,
      lookup, sendCode, verify, logout,
      refreshMe, updateMe, myBookings, cancelBooking, rescheduleBooking, bookAuthenticated,
    }}>
      {children}
    </ClientAuthContext.Provider>
  );
}

export function useClientAuth() {
  const ctx = useContext(ClientAuthContext);
  if (!ctx) throw new Error("useClientAuth() outside <ClientAuthProvider>");
  return ctx;
}
