import React, { useState, useEffect } from "react";
import { Outlet, NavLink, useNavigate, useLocation } from "react-router-dom";
import {
  LayoutDashboard, Building2, Users, Sparkles, DoorOpen,
  CalendarDays, ClipboardList, Contact, BarChart3, Settings,
  LogOut, Sun, Moon, Menu, X,
} from "lucide-react";
import { ThemeProvider, useTheme } from "../helpers/ThemeContext";
import { useAuth } from "../helpers/AuthContext";
import { SettingsProvider, useSettings } from "../helpers/SettingsContext";

import "../ui/styles/neo/neo-layout.css";
import "../ui/styles/neo/neo-sidebar.css";

const NAV_ITEMS = [
  { to: "/dashboard", label: "Дашборд",    Icon: LayoutDashboard, roles: ["owner", "admin", "employee"] },
  { to: "/branches",  label: "Филиалы",    Icon: Building2,       roles: ["owner"] },
  { to: "/employees", label: "Сотрудники", Icon: Users,           roles: ["owner", "admin"], modes: ["service"] },
  { to: "/services",  label: "Услуги",     Icon: Sparkles,        roles: ["owner", "admin"], modes: ["service"] },
  { to: "/rooms",     label: "Помещения",  Icon: DoorOpen,        roles: ["owner", "admin"], modes: ["room"] },
  { to: "/schedule",  label: "Расписание", Icon: CalendarDays,    roles: ["owner", "admin", "employee"] },
  { to: "/bookings",  label: "Записи",     Icon: ClipboardList,   roles: ["owner", "admin", "employee"] },
  { to: "/clients",   label: "Клиенты",    Icon: Contact,         roles: ["owner", "admin"] },
  { to: "/analytics", label: "Аналитика",  Icon: BarChart3,       roles: ["owner", "admin"] },
  { to: "/settings",  label: "Настройки",  Icon: Settings,        roles: ["owner"] },
];

function Sidebar({ open, onClose }) {
  const { theme, toggle } = useTheme();
  const { user, logout } = useAuth();
  const { bookingType } = useSettings();
  const navigate = useNavigate();
  const isDark = theme === "dark";

  const role = user?.role || "employee";
  const items = NAV_ITEMS.filter((it) =>
    it.roles.includes(role) && (!it.modes || it.modes.includes(bookingType))
  );

  function handleLogout() {
    logout();
    navigate("/login", { replace: true });
  }

  return (
    <aside className={`neo-sidebar${open ? " is-open" : ""}`}>
      {/* Header — logo + user card */}
      <div className="neo-sidebar-header">
        <h2 className="neo-sidebar-title">SLOTIQ PRO</h2>

        {user && (
          <div style={{
            padding: "10px 12px", borderRadius: 12,
            background: "var(--bg-card)", border: "1px solid var(--border)",
          }}>
            <div style={{
              fontSize: 13, fontWeight: 700, color: "var(--text-primary)",
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}>
              {user.name || user.email}
            </div>
            <div style={{
              fontSize: 10, color: "var(--text-muted)", marginTop: 2,
              textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 700,
            }}>
              {role}
            </div>
          </div>
        )}
      </div>

      {/* Nav (scrollable) */}
      <nav className="neo-sidebar-nav">
        {items.map((it) => (
          <NavLink
            key={it.to}
            to={it.to}
            onClick={onClose}
            className="neo-nav-item"
            style={{ display: "flex", alignItems: "center", gap: 10 }}
          >
            <it.Icon size={17} strokeWidth={2} />
            <span>{it.label}</span>
          </NavLink>
        ))}
      </nav>

      {/* Footer — always visible */}
      <div className="neo-sidebar-footer">
        <button className="neo-theme-toggle" onClick={toggle} title="Переключить тему">
          <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
            {isDark ? <Sun size={15} /> : <Moon size={15} />}
            {isDark ? "Светлая" : "Тёмная"}
          </span>
          <span className={`neo-theme-toggle-knob${isDark ? "" : " on"}`} />
        </button>
        <button
          onClick={handleLogout}
          style={{
            padding: "8px 12px", borderRadius: 10, cursor: "pointer",
            border: "1px solid var(--border)", background: "var(--bg-card)",
            color: "var(--text-secondary)", fontSize: 13, fontWeight: 600,
            textAlign: "left",
            display: "flex", alignItems: "center", gap: 10,
          }}
        >
          <LogOut size={15} />
          Выйти
        </button>
      </div>
    </aside>
  );
}

function PageTransition({ children }) {
  const { pathname } = useLocation();
  const [phase, setPhase] = useState("in");
  const [shownKey, setShownKey] = useState(pathname);

  useEffect(() => {
    if (pathname !== shownKey) {
      setPhase("out");
      const t = setTimeout(() => {
        setShownKey(pathname);
        setPhase("in");
      }, 110);
      return () => clearTimeout(t);
    }
  }, [pathname, shownKey]);

  return (
    <div
      key={shownKey}
      style={{
        opacity: phase === "in" ? 1 : 0,
        transform: phase === "in" ? "translateY(0)" : "translateY(6px)",
        transition: "opacity 0.18s ease, transform 0.18s ease",
        minHeight: "100%",
      }}
    >
      {children}
    </div>
  );
}

function LayoutShell() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="neo-layout">
      <button
        className="neo-sidebar-burger"
        onClick={() => setSidebarOpen(true)}
        aria-label="Открыть меню"
      >
        <Menu size={20} />
      </button>

      <div
        className={`neo-sidebar-overlay${sidebarOpen ? " is-open" : ""}`}
        onClick={() => setSidebarOpen(false)}
      />

      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <main className="neo-content">
        <PageTransition>
          <Outlet />
        </PageTransition>
      </main>
      <div id="portal-root" />
    </div>
  );
}

export default function AppLayout() {
  return (
    <ThemeProvider>
      <SettingsProvider>
        <LayoutShell />
      </SettingsProvider>
    </ThemeProvider>
  );
}
