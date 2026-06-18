import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  CalendarDays, Clock, MapPin, Sparkles, User as UserIcon, LogOut,
  Pencil, X, Plus, Check, Loader2, ArrowLeft, Sun, Moon,
  TrendingUp, Heart, Award, Gift, Bookmark, ArrowRight, CalendarClock,
} from "lucide-react";
import { useClientAuth } from "../helpers/ClientAuthContext.jsx";
import { formatRuPhone } from "../helpers/phoneMask.js";
import { getTheme, loadThemeName, saveThemeName } from "./theme.js";

function fmtFullDate(ymd) {
  if (!ymd) return "";
  const [y, m, d] = String(ymd).slice(0,10).split("-").map(Number);
  if (!y) return ymd;
  const dt = new Date(y, m-1, d);
  const months = ["января","февраля","марта","апреля","мая","июня","июля","августа","сентября","октября","ноября","декабря"];
  const days = ["вс","пн","вт","ср","чт","пт","сб"];
  return `${days[dt.getDay()]}, ${d} ${months[m-1]}`;
}

function getStatusVariants(T) {
  return {
    booked:    { label: "Запланировано", bg: `${T.info}1f`,    fg: T.info },
    confirmed: { label: "Подтверждено",  bg: `${T.success}1f`, fg: T.success },
    completed: { label: "Выполнено",     bg: `${T.success}1f`, fg: T.success },
    cancelled: { label: "Отменено",      bg: `${T.faint}25`,   fg: T.muted },
    no_show:   { label: "Не пришёл",     bg: `${T.danger}1f`,  fg: T.danger },
    // Synthetic: past date but still "booked" — admin hasn't marked outcome
    unmarked:  { label: "Без отметки",   bg: `${T.warning}1f`, fg: T.warning },
  };
}

/**
 * Compute effective status for a booking.
 * If date passed and status is still "booked"/"confirmed" — return "unmarked".
 */
function effectiveStatus(b, today) {
  const original = b.status || "booked";
  if (b.date < today && (original === "booked" || original === "confirmed")) {
    return "unmarked";
  }
  return original;
}

function fmtBirthday(ymd) {
  if (!ymd) return "";
  const s = String(ymd).slice(0, 10);
  const [, m, d] = s.split("-").map(Number);
  if (!m || !d) return s;
  const months = ["января","февраля","марта","апреля","мая","июня","июля","августа","сентября","октября","ноября","декабря"];
  return `${d} ${months[m-1]}`;
}

export default function MyCabinet() {
  const navigate = useNavigate();
  const { isLoggedIn, client, logout, myBookings, cancelBooking, rescheduleBooking, updateMe } = useClientAuth();
  const [rescheduleTarget, setRescheduleTarget] = useState(null);

  // Theme
  const [themeName, setThemeName] = useState(loadThemeName);
  const T = getTheme(themeName);
  const toggleTheme = () => {
    const next = themeName === "dark" ? "light" : "dark";
    setThemeName(next);
    saveThemeName(next);
  };

  const [bookings, setBookings] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [tab, setTab]           = useState("upcoming");
  const [editing, setEditing]   = useState(false);
  const [editForm, setEditForm] = useState({ full_name: "", email: "", birthday: "" });

  useEffect(() => {
    if (!isLoggedIn) { navigate("/booking"); return; }
    setEditForm({
      full_name: client?.full_name || "",
      email:     client?.email || "",
      birthday:  client?.birthday ? String(client.birthday).slice(0, 10) : "",
    });
    loadBookings();
  }, [isLoggedIn]);

  async function loadBookings() {
    setLoading(true);
    try { setBookings(await myBookings()); }
    catch { setBookings([]); }
    finally { setLoading(false); }
  }

  async function handleCancel(b) {
    if (!confirm(`Отменить запись на ${fmtFullDate(b.date)} в ${String(b.start_time).slice(0,5)}?`)) return;
    try {
      await cancelBooking(b.id);
      await loadBookings();
    } catch { alert("Не удалось отменить"); }
  }

  async function saveProfile() {
    try {
      await updateMe({
        full_name: editForm.full_name,
        email:     editForm.email,
        birthday:  editForm.birthday || null,
      });
      setEditing(false);
    } catch { alert("Не удалось сохранить"); }
  }

  const today = new Date().toISOString().slice(0, 10);
  const upcoming = bookings.filter(b => b.date >= today && b.status !== "cancelled");
  const history  = bookings.filter(b => b.date <  today || b.status === "cancelled");

  // Profile stats
  const stats = useMemo(() => {
    const completed = bookings.filter(b => ["completed","done","finished","confirmed"].includes(b.status));
    const totalSpent = completed.reduce((s, b) => s + Number(b.price || 0), 0);
    const firstDate = bookings.length > 0
      ? bookings.reduce((min, b) => b.date < min ? b.date : min, bookings[0].date)
      : null;
    return { totalVisits: completed.length, totalSpent, since: firstDate };
  }, [bookings]);

  // My places — unique branches visited
  const myPlaces = useMemo(() => {
    const map = new Map();
    for (const b of bookings) {
      const key = String(b.branch_id || "");
      if (!key) continue;
      const cur = map.get(key) || {
        branch_id: b.branch_id,
        name: b.branch_name,
        address: b.branch_address,
        visits: 0,
        lastDate: null,
        services: new Set(),
      };
      cur.visits += 1;
      if (b.service_name) cur.services.add(b.service_name);
      if (!cur.lastDate || b.date > cur.lastDate) cur.lastDate = b.date;
      map.set(key, cur);
    }
    return Array.from(map.values())
      .map(p => ({ ...p, services: Array.from(p.services).slice(0, 3) }))
      .sort((a, b) => (b.lastDate || "").localeCompare(a.lastDate || ""));
  }, [bookings]);

  const visible = tab === "upcoming" ? upcoming : history;
  const STATUS = getStatusVariants(T);
  const initials = (client?.full_name || "").split(" ").slice(0,2).map(p=>p[0]).join("").toUpperCase() || "?";

  if (!isLoggedIn) return null;

  return (
    <div style={{
      minHeight: "100vh",
      background: T.bgGrad,
      color: T.text,
      colorScheme: T.colorScheme,
      fontFamily: '"Inter", system-ui, sans-serif',
      padding: "20px 16px 50px",
    }}>
      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        {/* ── Header ── */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          marginBottom: 18, gap: 8,
        }}>
          <button onClick={() => navigate("/booking")} style={iconBtn(T)} title="К записи">
            <ArrowLeft size={16} />
          </button>
          <div style={{ flex: 1, textAlign: "center" }}>
            <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: "0.04em" }}>SLOTIQ</div>
            <div style={{ fontSize: 11, color: T.faint }}>Личный кабинет</div>
          </div>
          <button onClick={toggleTheme} style={iconBtn(T)}
            title={themeName === "dark" ? "Светлая тема" : "Тёмная тема"}>
            {themeName === "dark" ? <Sun size={15} /> : <Moon size={15} />}
          </button>
          <button onClick={() => { logout(); navigate("/booking"); }} style={iconBtn(T)} title="Выйти">
            <LogOut size={15} />
          </button>
        </div>

        {/* ── Profile hero ── */}
        <div style={{
          position: "relative",
          background: T.card,
          border: `1px solid ${T.border}`,
          borderRadius: 20,
          padding: 20,
          marginBottom: 14,
          overflow: "hidden",
        }}>
          {/* Decorative blob */}
          <div style={{
            position: "absolute", top: -60, right: -60,
            width: 200, height: 200, borderRadius: "50%",
            background: `radial-gradient(circle, ${T.accent}22, transparent 70%)`,
            pointerEvents: "none",
          }} />

          <div style={{ display: "flex", gap: 16, alignItems: "center", position: "relative" }}>
            <div style={{
              width: 64, height: 64, borderRadius: 18, flexShrink: 0,
              background: `linear-gradient(135deg, ${T.accent}, ${T.accent2})`,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 22, fontWeight: 800, color: "#fff",
              boxShadow: `0 10px 24px ${T.accent2}44`,
            }}>{initials}</div>

            <div style={{ flex: 1, minWidth: 0 }}>
              {!editing ? (
                <>
                  <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: "-0.02em" }}>
                    {client?.full_name || "Без имени"}
                  </div>
                  <div style={{ fontSize: 13, color: T.muted, marginTop: 2 }}>
                    {formatRuPhone(client?.phone || "")}
                  </div>
                  {client?.email && (
                    <div style={{ fontSize: 12, color: T.faint, marginTop: 1 }}>{client.email}</div>
                  )}
                  {client?.birthday && (
                    <div style={{
                      fontSize: 12, color: T.faint, marginTop: 2,
                      display: "inline-flex", alignItems: "center", gap: 4,
                    }}>
                      <Gift size={11} />
                      {fmtBirthday(client.birthday)}
                    </div>
                  )}
                </>
              ) : (
                <div style={{ display: "grid", gap: 6 }}>
                  <input
                    value={editForm.full_name}
                    onChange={(e) => setEditForm({...editForm, full_name: e.target.value})}
                    placeholder="Имя"
                    style={inputStyle(T)}
                    autoFocus
                  />
                  <input
                    value={editForm.email}
                    onChange={(e) => setEditForm({...editForm, email: e.target.value})}
                    placeholder="Email (опционально)"
                    type="email"
                    style={inputStyle(T)}
                  />
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <Gift size={13} color={T.muted} style={{ flexShrink: 0 }} />
                    <input
                      type="date"
                      value={editForm.birthday}
                      onChange={(e) => setEditForm({...editForm, birthday: e.target.value})}
                      placeholder="Дата рождения"
                      style={inputStyle(T)}
                    />
                  </div>
                </div>
              )}
            </div>

            <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
              {editing && (
                <button onClick={() => setEditing(false)} style={iconBtn(T)} title="Отмена">
                  <X size={14} />
                </button>
              )}
              <button
                onClick={() => editing ? saveProfile() : setEditing(true)}
                style={iconBtn(T)}
                title={editing ? "Сохранить" : "Изменить"}
              >
                {editing ? <Check size={16} color={T.accent} /> : <Pencil size={14} />}
              </button>
            </div>
          </div>

          {/* Stats */}
          {stats.totalVisits > 0 && (
            <div style={{
              marginTop: 16, paddingTop: 14, borderTop: `1px solid ${T.border}`,
              display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10,
            }}>
              <Stat T={T} icon={Award}      label="Визитов"   value={stats.totalVisits} />
              <Stat T={T} icon={TrendingUp} label="Потрачено" value={`${stats.totalSpent.toLocaleString("ru-RU")} ₽`} />
              <Stat T={T} icon={Heart}      label="С нами"    value={stats.since ? fmtSince(stats.since) : "—"} />
            </div>
          )}
        </div>

        {/* ── Tabs ── */}
        <div style={{ display: "flex", gap: 5, marginBottom: 12 }}>
          <TabBtn T={T} active={tab === "upcoming"} onClick={() => setTab("upcoming")} count={upcoming.length}>
            Предстоящие
          </TabBtn>
          <TabBtn T={T} active={tab === "history"} onClick={() => setTab("history")} count={history.length}>
            История
          </TabBtn>
        </div>

        {/* ── Bookings ── */}
        {loading ? (
          <div style={{ padding: 40, textAlign: "center", color: T.muted }}>
            <Loader2 size={20} className="cab-spin" />
          </div>
        ) : visible.length === 0 ? (
          <div style={{
            padding: "44px 24px", textAlign: "center",
            background: T.card, border: `1px dashed ${T.border}`, borderRadius: 16,
          }}>
            <div style={{
              width: 56, height: 56, borderRadius: 16,
              background: `linear-gradient(135deg, ${T.accent}22, ${T.accent2}22)`,
              border: `1px solid ${T.accent}33`,
              display: "inline-flex", alignItems: "center", justifyContent: "center",
              color: T.accent, marginBottom: 12,
            }}>
              <CalendarDays size={26} />
            </div>
            <div style={{ fontSize: 15, fontWeight: 700, color: T.text, marginBottom: 4 }}>
              {tab === "upcoming" ? "Нет предстоящих записей" : "История пуста"}
            </div>
            <div style={{ fontSize: 12, color: T.faint, marginBottom: 16, maxWidth: 280, margin: "0 auto 16px" }}>
              {tab === "upcoming"
                ? "Запишитесь на услугу — здесь появятся ваши визиты"
                : "Когда сделаете первую запись, она будет здесь"}
            </div>
            {tab === "upcoming" && (
              <button
                onClick={() => navigate("/booking")}
                style={{
                  padding: "10px 18px", borderRadius: 11, border: "none",
                  background: `linear-gradient(90deg, ${T.accent}, ${T.accent2})`,
                  color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer",
                  display: "inline-flex", alignItems: "center", gap: 6,
                  boxShadow: `0 10px 24px ${T.accent2}44`,
                }}
              >
                <Plus size={14}/> Записаться
              </button>
            )}
          </div>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {visible.map(b => <BookingCard
              key={b.id} b={b} T={T} STATUS={STATUS} today={today}
              onCancel={() => handleCancel(b)}
              canModify={tab === "upcoming"}
            />)}
          </div>
        )}

        {/* ── My Places ── */}
        {myPlaces.length > 0 && (
          <div style={{ marginTop: 22 }}>
            <div style={{
              display: "flex", alignItems: "center", gap: 7, marginBottom: 10,
              fontSize: 11, fontWeight: 700, color: T.faint,
              textTransform: "uppercase", letterSpacing: "0.08em",
            }}>
              <Bookmark size={12} color={T.accent} />
              Мои места
            </div>
            <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))" }}>
              {myPlaces.map(p => (
                <PlaceCard key={p.branch_id} T={T} place={p} onBook={() => {
                  navigate(`/booking?branch=${p.branch_id}`);
                }} />
              ))}
            </div>
          </div>
        )}

        <style>{`@keyframes cab-spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}.cab-spin{animation:cab-spin 1s linear infinite}`}</style>
      </div>

      {rescheduleTarget && (
        <RescheduleModal
          T={T}
          booking={rescheduleTarget}
          onClose={() => setRescheduleTarget(null)}
          onSaved={async () => { setRescheduleTarget(null); await loadBookings(); }}
          reschedule={rescheduleBooking}
        />
      )}
    </div>
  );
}

/* ─── Reschedule modal ─── */
function RescheduleModal({ T, booking, onClose, onSaved, reschedule }) {
  const dur = (() => {
    const s = String(booking.start_time).split(":").map(Number);
    const e = String(booking.end_time).split(":").map(Number);
    return (e[0]*60 + (e[1]||0)) - (s[0]*60 + (s[1]||0));
  })();
  const [date, setDate] = useState(String(booking.date).slice(0,10));
  const [start, setStart] = useState(String(booking.start_time).slice(0,5));
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const endTime = (() => {
    const [h, m] = start.split(":").map(Number);
    const total = h*60 + (m||0) + dur;
    return `${String(Math.floor(total/60)).padStart(2,"0")}:${String(total%60).padStart(2,"0")}`;
  })();

  async function save() {
    setErr("");
    if (!date || !start) return setErr("Заполните все поля");
    setSaving(true);
    try {
      await reschedule(booking.id, { date, start_time: start, end_time: endTime });
      onSaved?.();
    } catch (e) {
      const c = e?.payload?.error;
      if (c === "SLOT_TAKEN") setErr("Это время уже занято");
      else if (c === "CANNOT_RESCHEDULE") setErr("Эту запись нельзя перенести");
      else setErr(e?.message || "Не удалось перенести");
    } finally { setSaving(false); }
  }

  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, zIndex: 1000,
      background: "rgba(0,0,0,0.6)", backdropFilter: "blur(8px)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        width: "100%", maxWidth: 380,
        background: T.card2, border: `1px solid ${T.border}`,
        borderRadius: 20, padding: 22, color: T.text,
        boxShadow: "0 30px 80px rgba(0,0,0,0.5)",
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 10,
              background: `linear-gradient(135deg, ${T.accent}, ${T.accent2})`,
              display: "flex", alignItems: "center", justifyContent: "center", color: "#fff",
            }}>
              <CalendarClock size={15} />
            </div>
            <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: "-0.01em" }}>
              Перенести запись
            </div>
          </div>
          <button onClick={onClose} style={iconBtn(T)}><X size={14}/></button>
        </div>

        <div style={{ fontSize: 12, color: T.muted, marginBottom: 12 }}>
          {booking.service_name} · {booking.branch_name}
        </div>

        <div style={{ display: "grid", gap: 10, marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: T.faint, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>Новая дата</div>
            <input type="date" value={date} onChange={e => setDate(e.target.value)}
              min={new Date().toISOString().slice(0,10)}
              style={inputStyle(T)} />
          </div>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: T.faint, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>Время начала</div>
            <input type="time" value={start} onChange={e => setStart(e.target.value)} style={inputStyle(T)} />
            <div style={{ fontSize: 11, color: T.faint, marginTop: 3 }}>Окончание: {endTime}</div>
          </div>
        </div>

        {err && (
          <div style={{
            padding: "8px 10px", borderRadius: 8, marginBottom: 10,
            background: "rgba(239,68,68,0.10)", border: "1px solid rgba(239,68,68,0.35)",
            color: "#fca5a5", fontSize: 12,
          }}>{err}</div>
        )}

        <button onClick={save} disabled={saving} style={{
          width: "100%", padding: "11px", borderRadius: 11, border: "none",
          cursor: saving ? "wait" : "pointer", opacity: saving ? 0.7 : 1,
          background: `linear-gradient(90deg, ${T.accent}, ${T.accent2})`,
          color: "#fff", fontWeight: 700, fontSize: 13,
          display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
        }}>
          {saving ? <Loader2 size={14} className="cab-spin"/> : <CalendarClock size={14}/>}
          Подтвердить перенос
        </button>
      </div>
    </div>
  );
}

/* ─── My Places ─── */
function PlaceCard({ T, place, onBook }) {
  return (
    <button onClick={onBook} style={{
      textAlign: "left", cursor: "pointer",
      background: T.card, border: `1px solid ${T.border}`,
      borderRadius: 14, padding: "14px 16px",
      display: "grid", gap: 6, color: "inherit",
      transition: "all 0.15s",
      position: "relative", overflow: "hidden",
    }}
    onMouseEnter={(e) => {
      e.currentTarget.style.borderColor = T.accent;
      e.currentTarget.style.transform = "translateY(-2px)";
      e.currentTarget.style.boxShadow = `0 8px 20px ${T.accent2}26`;
    }}
    onMouseLeave={(e) => {
      e.currentTarget.style.borderColor = T.border;
      e.currentTarget.style.transform = "translateY(0)";
      e.currentTarget.style.boxShadow = "none";
    }}>
      <div style={{
        position: "absolute", top: -30, right: -30,
        width: 100, height: 100, borderRadius: "50%",
        background: `radial-gradient(circle, ${T.accent}1a, transparent 70%)`,
        pointerEvents: "none",
      }} />
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{
          width: 32, height: 32, borderRadius: 9, flexShrink: 0,
          background: `linear-gradient(135deg, ${T.accent}, ${T.accent2})`,
          display: "flex", alignItems: "center", justifyContent: "center",
          color: "#fff",
        }}>
          <MapPin size={15} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 14, fontWeight: 700, color: T.text, letterSpacing: "-0.01em",
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>{place.name}</div>
          {place.address && (
            <div style={{
              fontSize: 11, color: T.faint, marginTop: 1,
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}>{place.address}</div>
          )}
        </div>
        <ArrowRight size={14} color={T.faint} />
      </div>

      <div style={{ display: "flex", gap: 8, fontSize: 11, color: T.muted, marginTop: 2 }}>
        <span>Визитов: <b style={{ color: T.text }}>{place.visits}</b></span>
        {place.lastDate && (
          <>
            <span style={{ color: T.faint }}>·</span>
            <span>посл. {fmtBirthday(place.lastDate)}</span>
          </>
        )}
      </div>

      {place.services.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 4 }}>
          {place.services.map((s, i) => (
            <span key={i} style={{
              fontSize: 10, padding: "2px 7px", borderRadius: 999,
              background: `${T.accent}14`, color: T.accent,
              fontWeight: 600,
            }}>{s}</span>
          ))}
        </div>
      )}
    </button>
  );
}

/* ─── Sub-components ─── */

function Stat({ T, icon: Icon, label, value }) {
  return (
    <div style={{
      display: "flex", flexDirection: "column", gap: 4,
      padding: "8px 10px", borderRadius: 12,
      background: `${T.accent}0d`,
      border: `1px solid ${T.border}`,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 5, color: T.accent }}>
        <Icon size={11} />
        <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em" }}>
          {label}
        </span>
      </div>
      <div style={{ fontSize: 15, fontWeight: 800, color: T.text, letterSpacing: "-0.02em" }}>
        {value}
      </div>
    </div>
  );
}

function BookingCard({ b, T, STATUS, today, onCancel, onReschedule, canModify }) {
  const effStatus = effectiveStatus(b, today);
  const status = STATUS[effStatus] || STATUS.booked;
  const isCancelled = b.status === "cancelled";
  const isUnmarked = effStatus === "unmarked";

  return (
    <div style={{
      background: T.card, border: `1px solid ${T.border}`,
      borderRadius: 14, padding: "14px 16px",
      opacity: isCancelled ? 0.65 : 1,
      transition: "border-color 0.15s",
    }}
    onMouseEnter={(e) => !isCancelled && (e.currentTarget.style.borderColor = T.borderH)}
    onMouseLeave={(e) => (e.currentTarget.style.borderColor = T.border)}>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <span style={{
            fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 999,
            background: status.bg, color: status.fg,
            textTransform: "uppercase", letterSpacing: "0.04em",
            display: "inline-block", marginBottom: 8,
          }}>{status.label}</span>
          {isUnmarked && (
            <span style={{
              fontSize: 10, color: T.faint, marginLeft: 6,
            }}>дата прошла, бизнес ещё не отметил визит</span>
          )}

          <div style={{
            fontSize: 16, fontWeight: 800, color: T.text,
            letterSpacing: "-0.01em",
            display: "flex", alignItems: "center", gap: 7,
            textDecoration: isCancelled ? "line-through" : "none",
            flexWrap: "wrap",
          }}>
            <Sparkles size={14} color={T.accent} />
            {b.service_name || "Услуга"}
            {b.price > 0 && (
              <span style={{ fontSize: 13, fontWeight: 600, color: T.muted }}>
                · {Number(b.price).toLocaleString("ru-RU")} ₽
              </span>
            )}
          </div>

          <div style={{ marginTop: 8, display: "grid", gap: 4, fontSize: 12, color: T.muted }}>
            <Line T={T} icon={CalendarDays}>
              <b style={{ color: T.text, fontWeight: 600 }}>{fmtFullDate(b.date)}</b>
              <span style={{ color: T.faint, margin: "0 6px" }}>·</span>
              {String(b.start_time).slice(0,5)}–{String(b.end_time).slice(0,5)}
            </Line>
            <Line T={T} icon={MapPin}>
              {b.branch_name}
              {b.branch_address && <span style={{ color: T.faint }}> · {b.branch_address}</span>}
            </Line>
            {b.employee_name && <Line T={T} icon={UserIcon}>{b.employee_name}</Line>}
          </div>
        </div>

        {canModify && (
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <button onClick={onReschedule} style={{
              padding: "6px 12px", borderRadius: 10, cursor: "pointer",
              border: `1px solid ${T.accent}55`,
              background: `${T.accent}14`,
              color: T.accent, fontSize: 11, fontWeight: 600,
              flexShrink: 0, whiteSpace: "nowrap",
              display: "inline-flex", alignItems: "center", gap: 4,
            }}>
              <CalendarClock size={11}/>
              Перенести
            </button>
            <button onClick={onCancel} style={{
              padding: "6px 12px", borderRadius: 10, cursor: "pointer",
              border: `1px solid ${T.danger}55`,
              background: `${T.danger}14`,
              color: T.danger, fontSize: 11, fontWeight: 600,
              flexShrink: 0, whiteSpace: "nowrap",
            }}>
              Отменить
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function Line({ T, icon: Icon, children }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <Icon size={11} color={T.faint} style={{ flexShrink: 0 }} />
      <span>{children}</span>
    </div>
  );
}

function TabBtn({ T, active, onClick, children, count }) {
  return (
    <button onClick={onClick} style={{
      padding: "7px 14px", borderRadius: 999,
      border: `1.5px solid ${active ? T.accent : T.border}`,
      background: active ? `${T.accent}1a` : T.card,
      color: active ? T.accent : T.text,
      cursor: "pointer", fontSize: 12, fontWeight: 600,
      display: "inline-flex", alignItems: "center", gap: 6,
      transition: "all 0.15s",
    }}>
      {children}
      {count > 0 && (
        <span style={{
          fontSize: 10, padding: "1px 6px", borderRadius: 999,
          background: active ? T.accent : `${T.text}14`,
          color: active ? "#fff" : T.muted, fontWeight: 700,
          minWidth: 16, textAlign: "center",
        }}>{count}</span>
      )}
    </button>
  );
}

function fmtSince(ymd) {
  const [, m, d] = String(ymd).slice(0,10).split("-").map(Number);
  const months = ["янв","фев","мар","апр","мая","июн","июл","авг","сен","окт","ноя","дек"];
  return `с ${d} ${months[m-1]}`;
}

const inputStyle = (T) => ({
  width: "100%", boxSizing: "border-box",
  padding: "8px 11px", borderRadius: 9,
  border: `1.5px solid ${T.border}`,
  background: T.cardHover, color: T.text,
  fontSize: 13, outline: "none",
});

const iconBtn = (T) => ({
  width: 34, height: 34, borderRadius: 10,
  border: `1px solid ${T.border}`,
  background: T.card,
  color: T.text, cursor: "pointer",
  display: "flex", alignItems: "center", justifyContent: "center",
  flexShrink: 0,
  transition: "all 0.15s",
});
