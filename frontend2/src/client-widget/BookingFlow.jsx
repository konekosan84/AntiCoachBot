/**
 * BookingFlow — «меню, не анкета».
 *
 * Концепция:
 *  · Услуги показаны как карточки (как в Wolt / App Store)
 *  · На каждой карточке: цена · длительность · ближайшее окно
 *  · Клик по карточке = inline-раскрытие со всей бронью внутри
 *  · Фильтры даты/филиала сверху — опционально
 *  · Никаких шагов "wizard". Свернутые карточки всегда видны.
 *
 * Public route: /booking
 */
import { useEffect, useMemo, useState } from "react";
import {
  Sparkles, MapPin, User, Clock, CalendarDays, Phone, Check,
  ChevronDown, Loader2, ArrowRight, Info, Sun, Moon, LogIn, UserCircle,
} from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  getWidgetBranches,
  getWidgetServices,
  getWidgetEmployees,
  getWidgetShifts,
  getWidgetBookings,
  createWidgetBooking,
} from "../api/widget.js";
import { formatRuPhone, toRawPhone } from "../helpers/phoneMask.js";
import { useClientAuth } from "../helpers/ClientAuthContext.jsx";
import LoginModal from "./LoginModal.jsx";
import { THEMES, loadThemeName, saveThemeName, getTheme } from "./theme.js";

// Mutable theme reference used inside this module. Reassigned in BookingFlow().
let C = getTheme("dark");

/* ─── Date utils ──────────────────────── */
function pad(n) { return String(n).padStart(2,"0"); }
function todayYmd() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
}
function addDays(ymd, n) {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(y, m-1, d); dt.setDate(dt.getDate()+n);
  return `${dt.getFullYear()}-${pad(dt.getMonth()+1)}-${pad(dt.getDate())}`;
}
function fmtFullDate(ymd) {
  if (!ymd) return "";
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(y, m-1, d);
  const months = ["января","февраля","марта","апреля","мая","июня","июля","августа","сентября","октября","ноября","декабря"];
  const days = ["вс","пн","вт","ср","чт","пт","сб"];
  return `${days[dt.getDay()]}, ${d} ${months[m-1]}`;
}
function relativeDate(ymd) {
  if (!ymd) return "";
  const t = todayYmd();
  if (ymd === t) return "сегодня";
  if (ymd === addDays(t, 1)) return "завтра";
  if (ymd === addDays(t, 2)) return "послезавтра";
  const [, m, d] = ymd.split("-").map(Number);
  const months = ["янв","фев","мар","апр","мая","июн","июл","авг","сен","окт","ноя","дек"];
  return `${d} ${months[m-1]}`;
}
function fmtMin(min) {
  const h = Math.floor(min/60), m = min%60;
  if (h && m) return `${h}ч ${m}мин`;
  if (h) return `${h}ч`;
  return `${m}мин`;
}
function fmtMoney(v) { return Number(v||0).toLocaleString("ru-RU"); }
function toMin(hhmm) {
  const [h, m] = String(hhmm || "0:0").split(":").map(Number);
  return (h||0) * 60 + (m||0);
}
function fromMin(min) {
  return `${pad(Math.floor(min/60))}:${pad(min%60)}`;
}

/* ─── Date filter helpers ─────────────── */
function isWithinFilter(ymd, filter) {
  if (filter === "any") return true;
  const t = todayYmd();
  if (filter === "today")    return ymd === t;
  if (filter === "tomorrow") return ymd === addDays(t, 1);
  if (filter === "weekend") {
    const [y, m, d] = ymd.split("-").map(Number);
    const dt = new Date(y, m-1, d);
    const dow = dt.getDay();
    return (dow === 0 || dow === 6) && ymd >= t && ymd <= addDays(t, 7);
  }
  // Specific date "YYYY-MM-DD"
  if (/^\d{4}-\d{2}-\d{2}$/.test(filter)) return ymd === filter;
  return true;
}

/* ─── Core: compute available slots ───── */
function computeAvailability({ service, shifts, employees, existingBookings, branchFilter, dateFilter }) {
  if (!service) return { slots: [], nearestSlot: null, byDate: new Map() };

  const duration = Number(service.duration) || 60;
  const step = 30;
  const today = todayYmd();
  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes() + 15; // 15 min buffer

  // Which employees can do this service?
  const eligibleEmps = employees.filter(e => {
    const sIds = Array.isArray(e.services) ? e.services.map(x => Number(x.id ?? x))
              : Array.isArray(e.service_ids) ? e.service_ids.map(Number)
              : null;
    if (!sIds || sIds.length === 0) return true; // unconstrained
    return sIds.includes(Number(service.id));
  });
  const empIds = new Set(eligibleEmps.map(e => Number(e.id)));

  // Which branches have this service?
  const allowedBranchIds = (() => {
    const bIds = Array.isArray(service.branch_ids) ? service.branch_ids
              : service.branch_id ? [service.branch_id] : null;
    return bIds ? new Set(bIds.map(Number)) : null; // null = any branch
  })();

  // Bookings indexed by (employee_id, date) for overlap check
  const busyMap = new Map();
  for (const b of existingBookings || []) {
    if (b.status === "cancelled") continue;
    const key = `${b.employee_id}|${String(b.date).slice(0,10)}`;
    if (!busyMap.has(key)) busyMap.set(key, []);
    busyMap.get(key).push({ start: toMin(b.start_time), end: toMin(b.end_time) });
  }

  // Collect slots from shifts
  const byDate = new Map(); // ymd → [{ time, branch_id, employee_id }]
  for (const sh of shifts) {
    const date = String(sh.date).slice(0,10);
    if (date < today) continue;
    if (!empIds.has(Number(sh.employee_id))) continue;
    if (allowedBranchIds && !allowedBranchIds.has(Number(sh.branch_id))) continue;
    if (branchFilter && Number(sh.branch_id) !== Number(branchFilter)) continue;

    const startMin = toMin(sh.start_time);
    const endMin   = toMin(sh.end_time);
    const dayCutoff = date === today ? nowMin : 0;
    const busy = busyMap.get(`${sh.employee_id}|${date}`) || [];

    for (let t = startMin; t + duration <= endMin; t += step) {
      if (t < dayCutoff) continue;
      // Check overlap with existing bookings on this employee
      const overlaps = busy.some(b => t < b.end && t + duration > b.start);
      if (overlaps) continue;
      const slot = { date, time: fromMin(t), branch_id: Number(sh.branch_id), employee_id: Number(sh.employee_id) };
      if (!byDate.has(date)) byDate.set(date, []);
      byDate.get(date).push(slot);
    }
  }

  // Sort each day's slots, dedupe by (date, time) — multiple emps possible per time
  for (const [date, list] of byDate.entries()) {
    list.sort((a, b) => a.time.localeCompare(b.time));
  }

  // Apply date filter to find nearest
  const matchingDates = Array.from(byDate.keys())
    .filter(d => isWithinFilter(d, dateFilter))
    .sort();

  const nearestSlot = matchingDates.length > 0 ? byDate.get(matchingDates[0])?.[0] || null : null;

  return { byDate, nearestSlot, matchingDates };
}

/* ═══════════════════════════════════════
   MAIN
   ═══════════════════════════════════════ */
export default function BookingFlow() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialBranchId = searchParams.get("branch") ? Number(searchParams.get("branch")) : null;
  const { isLoggedIn, client: authClient } = useClientAuth();

  // Theme
  const [themeName, setThemeName] = useState(loadThemeName);
  C = getTheme(themeName);

  const toggleTheme = () => {
    const next = themeName === "dark" ? "light" : "dark";
    setThemeName(next);
    saveThemeName(next);
  };

  // Login modal
  const [loginOpen, setLoginOpen] = useState(false);

  // Data
  const [branches, setBranches]     = useState([]);
  const [services, setServices]     = useState([]);
  const [employees, setEmployees]   = useState([]);
  const [shifts, setShifts]         = useState([]);
  const [bookings, setBookings]     = useState([]);
  const [loading, setLoading]       = useState(true);

  // Filters (branch can be pre-filled via ?branch= URL parameter)
  const [dateFilter, setDateFilter]     = useState("any");
  const [branchFilter, setBranchFilter] = useState(initialBranchId);

  // Expanded card
  const [expandedId, setExpandedId] = useState(null);

  // Load all reference data
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const dateFrom = todayYmd();
        const dateTo   = addDays(dateFrom, 30);
        const [b, s, e, sh] = await Promise.all([
          getWidgetBranches(),
          getWidgetServices(),
          getWidgetEmployees(),
          getWidgetShifts(dateFrom, dateTo),
        ]);
        if (cancelled) return;
        setBranches(Array.isArray(b) ? b : []);
        setServices(Array.isArray(s) ? s.filter(x => x.is_active !== false) : []);
        setEmployees(Array.isArray(e) ? e : []);
        setShifts(Array.isArray(sh) ? sh : []);
        // bookings for overlap check (optional)
        try {
          const bk = await getWidgetBookings(dateFrom, dateTo);
          if (!cancelled) setBookings(Array.isArray(bk?.data) ? bk.data : []);
        } catch {}
      } catch (er) {
        console.error("BookingFlow load:", er);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Per-service availability
  const servicesWithAvailability = useMemo(() => {
    return services.map(s => {
      const a = computeAvailability({
        service: s, shifts, employees, existingBookings: bookings,
        branchFilter, dateFilter,
      });
      return { ...s, _availability: a };
    });
  }, [services, shifts, employees, bookings, branchFilter, dateFilter]);

  // Sort: services with slots first (sorted by nearest), unavailable at end
  const sortedServices = useMemo(() => {
    return [...servicesWithAvailability].sort((a, b) => {
      const aN = a._availability.nearestSlot;
      const bN = b._availability.nearestSlot;
      if (aN && !bN) return -1;
      if (!aN && bN) return 1;
      if (!aN && !bN) return 0;
      const aKey = `${aN.date} ${aN.time}`;
      const bKey = `${bN.date} ${bN.time}`;
      return aKey.localeCompare(bKey);
    });
  }, [servicesWithAvailability]);

  // Filters: show branch filter only if > 1 branch
  const showBranchFilter = branches.length > 1;

  /* ─── Render ─── */
  if (loading) {
    return (
      <Shell>
        <div style={{ padding: "80px 0", textAlign: "center", color: C.muted }}>
          <Loader2 size={28} style={{ animation: "bf-spin 1s linear infinite" }} />
          <div style={{ marginTop: 10, fontSize: 13 }}>Загружаем…</div>
        </div>
        <style>{`@keyframes bf-spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style>
      </Shell>
    );
  }

  return (
    <Shell
      themeName={themeName}
      onToggleTheme={toggleTheme}
      isLoggedIn={isLoggedIn}
      client={authClient}
      onLogin={() => setLoginOpen(true)}
      onCabinet={() => navigate("/me")}
    >
      {/* Filters */}
      <FilterStrip
        dateFilter={dateFilter} onDateFilter={setDateFilter}
        branchFilter={branchFilter} onBranchFilter={setBranchFilter}
        branches={branches} showBranchFilter={showBranchFilter}
      />

      {/* Services list */}
      {sortedServices.length === 0 ? (
        <EmptyState message="Услуг пока нет" hint="Загляните позже" />
      ) : (
        <div style={{ display: "grid", gap: 10, marginTop: 14 }}>
          {sortedServices.map(s => (
            <ServiceCard
              key={s.id}
              service={s}
              branches={branches}
              employees={employees}
              expanded={expandedId === s.id}
              onToggle={() => setExpandedId(prev => prev === s.id ? null : s.id)}
              dateFilter={dateFilter}
              branchFilter={branchFilter}
              onBooked={() => setExpandedId(null)}
              isLoggedIn={isLoggedIn}
              authClient={authClient}
            />
          ))}
        </div>
      )}

      <LoginModal
        open={loginOpen}
        onClose={() => setLoginOpen(false)}
        onSuccess={() => setLoginOpen(false)}
        theme={C}
      />
    </Shell>
  );
}

/* ═══════════════════════════════════════
   SHELL
   ═══════════════════════════════════════ */
function Shell({ children, themeName, onToggleTheme, isLoggedIn, client, onLogin, onCabinet }) {
  return (
    <div style={{
      minHeight: "100vh",
      background: C.bgGrad,
      color: C.text,
      colorScheme: C.colorScheme,
      fontFamily: '"Inter", system-ui, -apple-system, sans-serif',
      padding: "20px 16px 50px",
    }}>
      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        {/* Header */}
        <div style={{
          marginBottom: 16, display: "flex", alignItems: "center", gap: 10,
        }}>
          <div style={{
            width: 36, height: 36, borderRadius: 11,
            background: `linear-gradient(135deg, ${C.accent}, ${C.accent2})`,
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "#fff", fontWeight: 800, fontSize: 16,
            flexShrink: 0,
          }}>S</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 700, letterSpacing: "0.04em" }}>SLOTIQ</div>
            <div style={{ fontSize: 11, color: C.faint }}>Онлайн-запись</div>
          </div>

          {/* Theme toggle */}
          <button
            onClick={onToggleTheme}
            title={themeName === "dark" ? "Светлая тема" : "Тёмная тема"}
            style={headerBtnStyle()}
          >
            {themeName === "dark" ? <Sun size={15} /> : <Moon size={15} />}
          </button>

          {/* Login / cabinet */}
          {isLoggedIn ? (
            <button
              onClick={onCabinet}
              title="Личный кабинет"
              style={{
                ...headerBtnStyle(),
                width: "auto", padding: "0 12px", gap: 6,
              }}
            >
              <UserCircle size={15} />
              <span style={{ fontSize: 12, fontWeight: 600, maxWidth: 100, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {(client?.full_name || "").split(" ")[0] || "Профиль"}
              </span>
            </button>
          ) : (
            <button
              onClick={onLogin}
              style={{
                padding: "7px 14px", borderRadius: 11, border: "none",
                background: `linear-gradient(90deg, ${C.accent}, ${C.accent2})`,
                color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer",
                display: "inline-flex", alignItems: "center", gap: 6,
                whiteSpace: "nowrap",
              }}
            >
              <LogIn size={13} />
              Войти
            </button>
          )}
        </div>
        {children}
      </div>
    </div>
  );
}

function headerBtnStyle() {
  return {
    width: 36, height: 36, borderRadius: 11,
    border: `1px solid ${C.border}`,
    background: C.card,
    color: C.text, cursor: "pointer",
    display: "flex", alignItems: "center", justifyContent: "center",
    flexShrink: 0,
  };
}

/* ═══════════════════════════════════════
   FILTERS
   ═══════════════════════════════════════ */
function FilterStrip({ dateFilter, onDateFilter, branchFilter, onBranchFilter, branches, showBranchFilter }) {
  const isCustomDate = /^\d{4}-\d{2}-\d{2}$/.test(dateFilter);
  const dateOptions = [
    { value: "any",      label: "Когда угодно" },
    { value: "today",    label: "Сегодня" },
    { value: "tomorrow", label: "Завтра" },
    { value: "weekend",  label: "На выходных" },
  ];

  return (
    <div style={{ display: "grid", gap: 8 }}>
      <FilterRow icon={CalendarDays} label="Когда">
        {dateOptions.map(o => (
          <FilterPill
            key={o.value}
            active={dateFilter === o.value}
            onClick={() => onDateFilter(o.value)}
          >
            {o.label}
          </FilterPill>
        ))}
        {/* Custom date — native date input styled as pill */}
        <label style={{
          padding: "5px 12px", borderRadius: 999, cursor: "pointer",
          border: `1.5px solid ${isCustomDate ? C.accent : C.border}`,
          background: isCustomDate ? `${C.accent}1a` : C.card,
          color: isCustomDate ? C.accent : C.text,
          fontSize: 12, fontWeight: 600,
          display: "inline-flex", alignItems: "center", gap: 5,
        }}>
          📅 {isCustomDate ? relativeDate(dateFilter) : "Своя дата"}
          <input
            type="date"
            min={todayYmd()}
            max={addDays(todayYmd(), 60)}
            value={isCustomDate ? dateFilter : ""}
            onChange={(e) => onDateFilter(e.target.value || "any")}
            style={{
              position: "absolute", opacity: 0, width: 0, height: 0,
              pointerEvents: "none",
            }}
            onClickCapture={(e) => { /* allow native */ }}
          />
        </label>
        {/* Visible date input as alternative (since hidden input has issues on some browsers) */}
        <input
          type="date"
          min={todayYmd()}
          max={addDays(todayYmd(), 60)}
          value={isCustomDate ? dateFilter : ""}
          onChange={(e) => onDateFilter(e.target.value || "any")}
          style={{
            padding: "4px 8px", borderRadius: 8,
            border: `1.5px solid ${isCustomDate ? C.accent : C.border}`,
            background: C.card, color: C.text,
            fontSize: 12, fontFamily: "inherit",
            colorScheme: "dark",
            cursor: "pointer", outline: "none",
          }}
        />
      </FilterRow>

      {showBranchFilter && (
        <FilterRow icon={MapPin} label="Где">
          <FilterPill
            active={branchFilter === null}
            onClick={() => onBranchFilter(null)}
          >
            Все филиалы
          </FilterPill>
          {branches.map(b => {
            const active = Number(branchFilter) === Number(b.id);
            return (
              <button
                key={b.id}
                onClick={() => onBranchFilter(Number(b.id))}
                style={{
                  padding: "6px 12px", borderRadius: 12,
                  border: `1.5px solid ${active ? C.accent : C.border}`,
                  background: active ? `${C.accent}1a` : C.card,
                  color: active ? C.accent : C.text,
                  cursor: "pointer", fontSize: 12, fontWeight: 600,
                  textAlign: "left", lineHeight: 1.25,
                  transition: "all 0.15s",
                }}
                title={b.address || ""}
              >
                <div>{b.name}</div>
                {b.address && (
                  <div style={{
                    fontSize: 10, opacity: 0.7, marginTop: 1, fontWeight: 500,
                  }}>{b.address}</div>
                )}
              </button>
            );
          })}
        </FilterRow>
      )}
    </div>
  );
}

function FilterRow({ icon: Icon, label, children }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
      <div style={{
        display: "inline-flex", alignItems: "center", gap: 5,
        fontSize: 10, fontWeight: 700, color: C.faint,
        textTransform: "uppercase", letterSpacing: "0.08em",
        minWidth: 50,
      }}>
        <Icon size={12} />
        {label}
      </div>
      <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
        {children}
      </div>
    </div>
  );
}

function FilterPill({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "5px 12px", borderRadius: 999,
        border: `1.5px solid ${active ? C.accent : C.border}`,
        background: active ? `${C.accent}1a` : C.card,
        color: active ? C.accent : C.text,
        cursor: "pointer", fontSize: 12, fontWeight: 600,
        transition: "all 0.15s",
      }}
    >
      {children}
    </button>
  );
}

/* ═══════════════════════════════════════
   SERVICE CARD
   ═══════════════════════════════════════ */
function ServiceCard({ service, branches, employees, expanded, onToggle, dateFilter, branchFilter, onBooked, isLoggedIn, authClient }) {
  const av = service._availability;
  const hasAvailability = !!av.nearestSlot;
  const nearest = av.nearestSlot;
  const nearestBranch = nearest ? branches.find(b => Number(b.id) === Number(nearest.branch_id)) : null;
  const nearestEmployee = nearest ? employees.find(e => Number(e.id) === Number(nearest.employee_id)) : null;

  return (
    <div style={{
      background: C.card,
      border: `1px solid ${expanded ? C.accent : C.border}`,
      borderRadius: 16,
      overflow: "hidden",
      transition: "border-color 0.2s",
    }}>
      {/* Header — always visible */}
      <button
        onClick={() => hasAvailability && onToggle()}
        disabled={!hasAvailability}
        style={{
          width: "100%", padding: "14px 16px",
          background: "transparent", border: "none",
          cursor: hasAvailability ? "pointer" : "not-allowed",
          textAlign: "left", color: "inherit",
          display: "flex", alignItems: "center", gap: 12,
          opacity: hasAvailability ? 1 : 0.5,
        }}
      >
        <div style={{
          width: 40, height: 40, borderRadius: 11, flexShrink: 0,
          background: hasAvailability
            ? `linear-gradient(135deg, ${C.accent}33, ${C.accent2}33)`
            : "rgba(255,255,255,0.04)",
          color: hasAvailability ? C.accent : C.faint,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <Sparkles size={18} />
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 15, fontWeight: 700, color: C.text,
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            letterSpacing: "-0.01em",
            display: "flex", alignItems: "center", gap: 6,
          }}>
            {service.name}
            {service.description && (
              <span
                onClick={(e) => e.stopPropagation()}
                title={service.description}
                style={{
                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                  width: 16, height: 16, borderRadius: "50%",
                  background: "rgba(255,255,255,0.06)",
                  color: C.faint, cursor: "help",
                  flexShrink: 0,
                }}
              >
                <Info size={10} />
              </span>
            )}
          </div>
          <div style={{
            fontSize: 12, color: C.muted, marginTop: 2,
            display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap",
          }}>
            <span>{fmtMoney(service.price)} ₽</span>
            <span style={{ color: C.faint }}>·</span>
            <span>{fmtMin(service.duration || 60)}</span>
            {nearest && (
              <>
                <span style={{ color: C.faint }}>·</span>
                <span style={{ color: C.accent, fontWeight: 600 }}>
                  <Clock size={11} style={{ verticalAlign: "-1px", marginRight: 3 }} />
                  {relativeDate(nearest.date)} в {nearest.time}
                  {nearestBranch && branches.length > 1 ? ` · ${nearestBranch.name}` : ""}
                </span>
              </>
            )}
            {!nearest && (
              <span style={{ color: "#fca5a5", fontWeight: 600 }}>
                Нет окон в ближайший месяц
              </span>
            )}
          </div>
        </div>

        {hasAvailability && (
          <ChevronDown
            size={18}
            color={C.faint}
            style={{
              transform: expanded ? "rotate(180deg)" : "rotate(0)",
              transition: "transform 0.2s",
              flexShrink: 0,
            }}
          />
        )}
      </button>

      {/* Expanded — booking flow inline */}
      {expanded && (
        <div style={{
          borderTop: `1px solid ${C.border}`,
          background: "rgba(0,0,0,0.20)",
        }}>
          <BookingPanel
            service={service}
            branches={branches}
            employees={employees}
            availability={av}
            nearest={nearest}
            nearestBranch={nearestBranch}
            nearestEmployee={nearestEmployee}
            onBooked={onBooked}
            branchFilter={branchFilter}
            isLoggedIn={isLoggedIn}
            authClient={authClient}
          />
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════
   BOOKING PANEL (inside expanded service card)
   ═══════════════════════════════════════ */
function BookingPanel({ service, branches, employees, availability, nearest, nearestBranch, nearestEmployee, onBooked, branchFilter, isLoggedIn, authClient }) {
  const { bookAuthenticated } = useClientAuth();
  const { byDate, matchingDates } = availability;

  // Pre-fill with nearest slot
  const [branchId, setBranchId]   = useState(nearestBranch?.id ?? branchFilter ?? null);
  const [date, setDate]           = useState(nearest?.date || null);
  const [time, setTime]           = useState(nearest?.time || null);
  const [employeeId, setEmployeeId] = useState(null); // null = "любой"
  const [client, setClient]       = useState({
    full_name: authClient?.full_name || "",
    phone:     authClient?.phone ? formatRuPhone(authClient.phone) : "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr]             = useState("");
  const [confirmed, setConfirmed] = useState(null);

  // Branches that have this service
  const eligibleBranches = useMemo(() => {
    const sBranchIds = Array.isArray(service.branch_ids) ? service.branch_ids.map(Number)
                    : service.branch_id ? [Number(service.branch_id)] : null;
    if (!sBranchIds) return branches;
    return branches.filter(b => sBranchIds.includes(Number(b.id)));
  }, [branches, service]);

  // Slots filtered by current selections (branch, employee)
  const slotsForCurrentDate = useMemo(() => {
    if (!date) return [];
    const list = byDate.get(date) || [];
    return list.filter(s => {
      if (branchId && Number(s.branch_id) !== Number(branchId)) return false;
      if (employeeId && Number(s.employee_id) !== Number(employeeId)) return false;
      return true;
    });
  }, [date, byDate, branchId, employeeId]);

  // Unique times for this date+branch+employee
  const uniqueTimes = useMemo(() => {
    const set = new Set();
    slotsForCurrentDate.forEach(s => set.add(s.time));
    return Array.from(set).sort();
  }, [slotsForCurrentDate]);

  // Available dates (after applying branch filter)
  const availableDates = useMemo(() => {
    const arr = [];
    for (const d of matchingDates) {
      const list = byDate.get(d) || [];
      const ok = list.some(s =>
        (!branchId || Number(s.branch_id) === Number(branchId)) &&
        (!employeeId || Number(s.employee_id) === Number(employeeId))
      );
      if (ok) arr.push(d);
    }
    return arr;
  }, [matchingDates, byDate, branchId, employeeId]);

  // Eligible employees for this service (and optionally branch)
  const eligibleEmployees = useMemo(() => {
    return employees.filter(e => {
      // service constraint
      const sIds = Array.isArray(e.services) ? e.services.map(x => Number(x.id ?? x))
                : Array.isArray(e.service_ids) ? e.service_ids.map(Number)
                : null;
      if (sIds && sIds.length > 0 && !sIds.includes(Number(service.id))) return false;
      // branch constraint
      if (branchId) {
        const bIds = Array.isArray(e.branches) ? e.branches.map(x => Number(x.id ?? x))
                  : Array.isArray(e.branch_ids) ? e.branch_ids.map(Number)
                  : [];
        if (!bIds.includes(Number(branchId))) return false;
      }
      return true;
    });
  }, [employees, service, branchId]);

  function pickBranch(id) {
    setBranchId(id);
    setEmployeeId(null);
    setTime(null);
    // Keep date if still available, else clear
    if (id !== null) {
      const list = byDate.get(date) || [];
      const ok = list.some(s => Number(s.branch_id) === Number(id));
      if (!ok) setDate(null);
    }
  }

  async function submit() {
    setErr("");
    if (!branchId)               return setErr("Выберите филиал");
    if (!date)                   return setErr("Выберите дату");
    if (!time)                   return setErr("Выберите время");
    if (!isLoggedIn) {
      if (!client.full_name.trim()) return setErr("Укажите имя");
      if (toRawPhone(client.phone).length !== 11) return setErr("Укажите телефон полностью");
    }

    setSubmitting(true);
    try {
      const dur = Number(service.duration) || 60;
      const endTime = fromMin(toMin(time) + dur);

      // Find an actual employee from the slot list if "any" chosen
      const slotMatch = slotsForCurrentDate.find(s => s.time === time);
      const finalEmpId = employeeId || slotMatch?.employee_id || null;

      const basePayload = {
        branch_id:   Number(branchId),
        service_id:  Number(service.id),
        employee_id: finalEmpId ? Number(finalEmpId) : null,
        date,
        start_time:  time,
        end_time:    endTime,
        price:       service.price ?? null,
      };

      if (isLoggedIn) {
        await bookAuthenticated(basePayload);
      } else {
        await createWidgetBooking({
          ...basePayload,
          status:    "booked",
          full_name: client.full_name.trim(),
          phone:     "+" + toRawPhone(client.phone),
        });
      }

      setConfirmed({
        ...basePayload,
        service_name: service.name,
        branch_name:  branches.find(b => Number(b.id) === Number(branchId))?.name,
        employee_name: finalEmpId ? employees.find(e => Number(e.id) === Number(finalEmpId))?.name : null,
      });
    } catch (e) {
      setErr(translateError(e?.payload?.error) || e?.message || "Не удалось оформить запись");
    } finally {
      setSubmitting(false);
    }
  }

  if (confirmed) {
    return <ConfirmedView data={confirmed} onClose={onBooked} />;
  }

  return (
    <div style={{ padding: 16, display: "grid", gap: 14 }}>
      {/* Suggestion banner if nearest slot pre-filled */}
      {nearest && branchId === nearest.branch_id && date === nearest.date && time === nearest.time && (
        <div style={{
          padding: "8px 12px", borderRadius: 10,
          background: `${C.accent}1a`, border: `1px solid ${C.accent}44`,
          fontSize: 12, color: C.accent, display: "flex", alignItems: "center", gap: 6,
        }}>
          <Sparkles size={13} />
          Подобрали ближайшее свободное окно
          {nearestEmployee && ` · ${nearestEmployee.name}`}
        </div>
      )}

      {/* Branch selector — only if >1 eligible */}
      {eligibleBranches.length > 1 && (
        <Block icon={MapPin} title="Филиал">
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {eligibleBranches.map(b => {
              const isSelected = Number(branchId) === Number(b.id);
              return (
                <button key={b.id}
                  onClick={() => pickBranch(b.id)}
                  style={chipStyle(isSelected)}
                  title={[b.address, b.phone, b.description_client].filter(Boolean).join(" · ")}
                >
                  {isSelected && <Check size={12} />}
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600 }}>{b.name}</div>
                    {b.address && <div style={{ fontSize: 10, opacity: 0.75 }}>{b.address}</div>}
                  </div>
                  {b.description_client && (
                    <span style={{
                      display: "inline-flex", alignItems: "center", justifyContent: "center",
                      width: 14, height: 14, borderRadius: "50%",
                      background: "rgba(255,255,255,0.10)", color: C.faint,
                      flexShrink: 0, marginLeft: 4,
                    }}>
                      <Info size={9} />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </Block>
      )}

      {/* Employee selector — optional */}
      {branchId && eligibleEmployees.length > 1 && (
        <Block icon={User} title="Специалист" hint="можно не выбирать">
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            <button onClick={() => { setEmployeeId(null); setTime(null); }}
              style={chipStyle(!employeeId)}
            >
              {!employeeId && <Check size={12} />}
              Любой
            </button>
            {eligibleEmployees.map(e => {
              const isSelected = Number(employeeId) === Number(e.id);
              const desc = [e.position, e.description_client].filter(Boolean).join(" · ");
              return (
                <button key={e.id}
                  onClick={() => { setEmployeeId(e.id); setTime(null); }}
                  style={chipStyle(isSelected)}
                  title={desc}
                >
                  {isSelected && <Check size={12} />}
                  {e.name}
                  {e.description_client && (
                    <span style={{
                      display: "inline-flex", alignItems: "center", justifyContent: "center",
                      width: 14, height: 14, borderRadius: "50%",
                      background: "rgba(255,255,255,0.10)", color: C.faint,
                      flexShrink: 0, marginLeft: 2,
                    }}>
                      <Info size={9} />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </Block>
      )}

      {/* Date picker — horizontal scroll */}
      {branchId && (
        <Block icon={CalendarDays} title="Дата">
          {availableDates.length === 0 ? (
            <div style={{ fontSize: 12, color: "#fca5a5", padding: "6px 0" }}>
              На этот филиал нет свободных дат в ближайший месяц
            </div>
          ) : (
            <div style={{ display: "flex", gap: 5, overflowX: "auto", paddingBottom: 4 }}>
              {availableDates.map(d => {
                const [, m, dd] = d.split("-").map(Number);
                const dt = new Date(d);
                const dow = ["Вс","Пн","Вт","Ср","Чт","Пт","Сб"][dt.getDay()];
                const sel = date === d;
                return (
                  <button key={d}
                    onClick={() => { setDate(d); setTime(null); }}
                    style={{
                      minWidth: 52, padding: "8px 6px", borderRadius: 10,
                      border: `1.5px solid ${sel ? C.accent : C.border}`,
                      background: sel ? `${C.accent}1a` : C.card,
                      color: sel ? C.accent : C.text,
                      cursor: "pointer", flexShrink: 0,
                      display: "grid", gap: 1, transition: "all 0.15s",
                    }}
                  >
                    <div style={{ fontSize: 10, fontWeight: 600, color: sel ? C.accent : C.faint }}>{dow}</div>
                    <div style={{ fontSize: 17, fontWeight: 700 }}>{dd}</div>
                    <div style={{ fontSize: 9, color: sel ? C.accent : C.faint }}>
                      {relativeDate(d).length <= 8 ? relativeDate(d) : ["янв","фев","мар","апр","мая","июн","июл","авг","сен","окт","ноя","дек"][m-1]}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </Block>
      )}

      {/* Time slots */}
      {date && (
        <Block icon={Clock} title="Время">
          {uniqueTimes.length === 0 ? (
            <div style={{ fontSize: 12, color: "#fca5a5", padding: "6px 0" }}>
              На этот день окон не осталось
            </div>
          ) : (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
              {uniqueTimes.map(t => {
                const sel = time === t;
                return (
                  <button key={t} onClick={() => setTime(t)}
                    style={{
                      minWidth: 56, padding: "6px 10px", borderRadius: 8,
                      border: `1.5px solid ${sel ? C.accent : C.border}`,
                      background: sel ? `${C.accent}1a` : C.card,
                      color: sel ? C.accent : C.text,
                      cursor: "pointer", fontSize: 12, fontWeight: 600,
                      transition: "all 0.15s",
                    }}
                  >
                    {t}
                  </button>
                );
              })}
            </div>
          )}
        </Block>
      )}

      {/* Contacts — skip if logged in */}
      {time && !isLoggedIn && (
        <Block icon={Phone} title="Ваши контакты">
          <div style={{ display: "grid", gap: 6 }}>
            <input
              placeholder="Ваше имя"
              value={client.full_name}
              onChange={(e) => setClient({ ...client, full_name: e.target.value })}
              style={inputStyle}
            />
            <input
              placeholder="+7 (___) ___-__-__"
              value={client.phone}
              onChange={(e) => setClient({ ...client, phone: formatRuPhone(e.target.value) })}
              onFocus={() => { if (!client.phone) setClient({ ...client, phone: "+7 (" }); }}
              inputMode="tel"
              style={inputStyle}
            />
          </div>
        </Block>
      )}

      {/* Logged-in hint */}
      {time && isLoggedIn && (
        <div style={{
          padding: "8px 12px", borderRadius: 10,
          background: `${C.accent}1a`, border: `1px solid ${C.accent}44`,
          fontSize: 12, color: C.accent,
          display: "flex", alignItems: "center", gap: 6,
        }}>
          <UserCircle size={13} />
          Записываем как {authClient?.full_name || "вас"} ({formatRuPhone(authClient?.phone || "")})
        </div>
      )}

      {/* CTA */}
      {time && (
        <div>
          <button
            onClick={submit}
            disabled={submitting}
            style={{
              width: "100%", padding: "12px", borderRadius: 12, border: "none",
              cursor: submitting ? "wait" : "pointer",
              background: `linear-gradient(90deg, ${C.accent}, ${C.accent2})`,
              color: "#fff", fontSize: 14, fontWeight: 700,
              boxShadow: `0 10px 24px ${C.accent2}44`,
              opacity: submitting ? 0.7 : 1,
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            }}
          >
            {submitting ? "Оформляем…" : <>Записаться на {time} <ArrowRight size={15}/></>}
          </button>
          {err && (
            <div style={{
              marginTop: 8, padding: "8px 10px", borderRadius: 8,
              background: "rgba(239,68,68,0.10)", border: "1px solid rgba(239,68,68,0.35)",
              color: "#fca5a5", fontSize: 12,
            }}>{err}</div>
          )}
        </div>
      )}
    </div>
  );
}

function Block({ icon: Icon, title, hint, children }) {
  return (
    <div>
      <div style={{
        display: "flex", alignItems: "center", gap: 6, marginBottom: 6,
        fontSize: 10, fontWeight: 700, color: C.faint,
        textTransform: "uppercase", letterSpacing: "0.06em",
      }}>
        <Icon size={11} />
        {title}
        {hint && <span style={{ color: C.faint, textTransform: "none", fontWeight: 500, marginLeft: 2 }}>· {hint}</span>}
      </div>
      {children}
    </div>
  );
}

function chipStyle(active) {
  return {
    padding: "5px 12px", borderRadius: 999,
    border: `1.5px solid ${active ? C.accent : C.border}`,
    background: active ? `${C.accent}1a` : C.card,
    color: active ? C.accent : C.text,
    cursor: "pointer", fontSize: 12, fontWeight: 600,
    display: "inline-flex", alignItems: "center", gap: 6,
    textAlign: "left",
    transition: "all 0.15s",
  };
}

const inputStyle = {
  width: "100%",
  padding: "9px 12px",
  borderRadius: 10,
  border: `1.5px solid ${C.border}`,
  background: C.card,
  color: C.text,
  fontSize: 13,
  outline: "none",
  boxSizing: "border-box",
};

/* ═══════════════════════════════════════
   CONFIRMED VIEW
   ═══════════════════════════════════════ */
function ConfirmedView({ data, onClose }) {
  return (
    <div style={{ padding: 18 }}>
      <div style={{
        background: `linear-gradient(135deg, ${C.accent}1a, ${C.accent2}1a)`,
        border: `1px solid ${C.accent}55`,
        borderRadius: 14, padding: 18,
      }}>
        <div style={{
          width: 44, height: 44, borderRadius: "50%",
          background: `linear-gradient(135deg, ${C.accent}, ${C.accent2})`,
          margin: "0 auto 10px",
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: `0 10px 24px ${C.accent}55`,
        }}>
          <Check size={22} color="#fff" strokeWidth={3} />
        </div>
        <div style={{ fontSize: 17, fontWeight: 800, textAlign: "center", letterSpacing: "-0.02em" }}>
          Запись подтверждена
        </div>
        <div style={{ fontSize: 12, color: C.muted, textAlign: "center", marginTop: 4 }}>
          SMS-напоминание придёт за день до визита
        </div>
        <div style={{
          marginTop: 14, padding: 12, borderRadius: 10,
          background: "rgba(0,0,0,0.25)", display: "grid", gap: 6, fontSize: 13,
        }}>
          <Row k="Услуга"   v={data.service_name} />
          <Row k="Филиал"   v={data.branch_name} />
          {data.employee_name && <Row k="Мастер" v={data.employee_name} />}
          <Row k="Дата"     v={fmtFullDate(data.date)} />
          <Row k="Время"    v={`${data.start_time} – ${data.end_time}`} />
          {data.price && <Row k="К оплате" v={`${fmtMoney(data.price)} ₽`} />}
        </div>
        <button onClick={onClose} style={{
          marginTop: 14, width: "100%", padding: 10, borderRadius: 10,
          border: `1px solid ${C.border}`, background: "rgba(0,0,0,0.20)",
          color: C.text, fontSize: 13, fontWeight: 600, cursor: "pointer",
        }}>
          Готово
        </button>
      </div>
    </div>
  );
}

function Row({ k, v }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
      <span style={{ color: C.faint }}>{k}</span>
      <b style={{ color: C.text, textAlign: "right" }}>{v}</b>
    </div>
  );
}

function EmptyState({ message, hint }) {
  return (
    <div style={{
      padding: "48px 24px", textAlign: "center",
      background: C.card, border: `1px dashed ${C.border}`,
      borderRadius: 16, marginTop: 14,
    }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{message}</div>
      {hint && <div style={{ fontSize: 12, color: C.faint, marginTop: 6 }}>{hint}</div>}
    </div>
  );
}

function translateError(code) {
  const map = {
    FULL_NAME_REQUIRED:    "Укажите имя",
    PHONE_REQUIRED:        "Укажите телефон",
    DATE_REQUIRED:         "Выберите дату",
    START_TIME_REQUIRED:   "Выберите время",
    INVALID_PHONE:         "Телефон некорректный",
    BOOKING_OVERLAP:       "Это время уже занято — выберите другое",
    ROOM_OVERLAP:          "Помещение занято на это время",
    EMPLOYEE_UNAVAILABLE:  "Мастер недоступен в это время",
  };
  return map[code] || null;
}
