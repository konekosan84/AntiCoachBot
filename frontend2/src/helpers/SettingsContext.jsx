import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { apiFetch } from "../api/apiFetch.js";

const SettingsContext = createContext(null);

const DEFAULT_SETTINGS = { booking_type: "service" };

export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [loaded, setLoaded] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const data = await apiFetch("/api/v1/settings");
      setSettings({ booking_type: data?.booking_type || "service" });
    } catch (e) {
      console.warn("Failed to load settings, using defaults:", e?.message);
      setSettings(DEFAULT_SETTINGS);
    } finally {
      setLoaded(true);
    }
  }, []);

  const update = useCallback(async (patch) => {
    const data = await apiFetch("/api/v1/settings", {
      method: "PUT",
      body: JSON.stringify(patch),
    });
    setSettings({ booking_type: data?.booking_type || "service" });
    return data;
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  return (
    <SettingsContext.Provider value={{
      settings,
      loaded,
      bookingType: settings.booking_type,
      isServiceMode: settings.booking_type === "service",
      isRoomMode:    settings.booking_type === "room",
      refresh,
      update,
    }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings() must be inside <SettingsProvider>");
  return ctx;
}
