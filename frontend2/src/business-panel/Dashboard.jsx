import { useEffect, useMemo, useState } from "react";
import { getDirectorDashboard } from "../api/dashboard";
import { getBranches } from "../api/branches";
import Sparkline from "../ui/Sparkline.jsx";
import AreaChart from "../ui/AreaChart.jsx";
import { SkeletonKpi, SkeletonCardGrid } from "../ui/Skeleton.jsx";
import {
  Users, Sparkles, Flame, Repeat, ClipboardList,
  CalendarCheck, XCircle,
} from "lucide-react";

/* ── Utils ─────────────────────────────────────────────────── */
function todayYmd() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
}
function daysAgoYmd(n) {
  const d = new Date(); d.setDate(d.getDate()-n);
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
}
function monthStartYmd() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-01`;
}
function pad(n) { return String(n).padStart(2,"0"); }

function formatPhone(phone) {
  const digits = String(phone||"").replace(/\D/g,"");
  if (!digits) return "—";
  const core = digits.length===11&&digits.startsWith("7") ? digits.slice(1) : digits.slice(-10);
  return `+7 (${core.slice(0,3)}) ${core.slice(3,6)}-${core.slice(6,8)}-${core.slice(8,10)}`;
}
function formatDate(v) {
  if (!v) return "—";
  // Accept "YYYY-MM-DD" directly to avoid timezone drift
  const ymd = String(v).slice(0, 10);
  const [y, m, d] = ymd.split("-").map(Number);
  if (!y || !m || !d) return String(v);
  const months = ["янв","фев","мар","апр","мая","июн","июл","авг","сен","окт","ноя","дек"];
  return `${d} ${months[m-1]}`;
}
function formatDateTime(v) {
  if (!v) return "—";
  try { return new Date(v).toLocaleString("ru-RU",{day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"}); }
  catch { return String(v); }
}
function formatTime(v) {
  if (!v) return "";
  return String(v).slice(0, 5);
}
function initials(name) {
  const parts = String(name||"").trim().split(/\s+/);
  if (parts.length>=2) return (parts[0][0]+(parts[1][0])).toUpperCase();
  return String(name||"?")[0].toUpperCase();
}

const STATUS_LABELS = {
  booked:"Запись", completed:"Выполнено", done:"Выполнено", finished:"Выполнено",
  confirmed:"Подтверждено", cancelled:"Отменено", no_show:"Не пришёл",
};
function statusLabel(s) { return STATUS_LABELS[s] || s || "Запись"; }

function statusVars(s) {
  if (s==="cancelled") return { bg:"var(--badge-cancel-bg)", color:"var(--badge-cancel-text)", border:"var(--badge-cancel-border)" };
  if (["completed","done","finished","confirmed"].includes(s)) return { bg:"var(--badge-done-bg)", color:"var(--badge-done-text)", border:"var(--badge-done-border)" };
  if (s==="no_show") return { bg:"var(--badge-noshow-bg)", color:"var(--badge-noshow-text)", border:"var(--badge-noshow-border)" };
  return { bg:"var(--badge-booked-bg)", color:"var(--badge-booked-text)", border:"var(--badge-booked-border)" };
}

const ACCENT_PALETTE = ["#3acfd5","#6558f5","#22c55e","#f59e0b","#ec4899","#3b82f6","#f97316","#a78bfa"];

/* ── Sub-components ─────────────────────────────────────────── */
function computeDelta(cur, prev) {
  const c = Number(cur) || 0;
  const p = Number(prev) || 0;
  if (p === 0 && c === 0) return null;
  if (p === 0) return { pct: 100, raw: c, direction: "up" };
  const pct = ((c - p) / p) * 100;
  return { pct, raw: c - p, direction: pct >= 0 ? "up" : "down" };
}

function DeltaBadge({ delta, invert = false }) {
  if (!delta) return null;
  const isPositive = delta.direction === "up";
  // For "good" metrics (clients, bookings), up=green. For "bad" metrics (cancellations), up=red.
  const isGood = invert ? !isPositive : isPositive;
  const color  = isGood ? "#22c55e" : "#ef4444";
  const bg     = isGood ? "rgba(34,197,94,0.12)" : "rgba(239,68,68,0.12)";
  const arrow  = isPositive ? "▲" : "▼";
  const value  = Math.abs(delta.pct);
  return (
    <span style={{
      fontSize: 11, fontWeight: 700, padding: "2px 7px", borderRadius: 6,
      background: bg, color, lineHeight: 1.2,
      display: "inline-flex", alignItems: "center", gap: 3,
    }}>
      {arrow} {value > 999 ? "999+" : value.toFixed(0)}%
    </span>
  );
}

function KpiCard({ Icon, title, value, accent, sub, delta, invertDelta, sparkData, tooltip }) {
  return (
    <div
      title={tooltip}
      style={{
        position: "relative",
        background: "var(--bg-card)", border: "1px solid var(--border)",
        borderRadius: 16, padding: "14px 16px",
        borderLeft: `3px solid ${accent}`,
        display: "flex", flexDirection: "column", gap: 6,
        transition: "transform 0.15s, box-shadow 0.15s",
        cursor: tooltip ? "help" : "default",
        minWidth: 0,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = "translateY(-2px)";
        e.currentTarget.style.boxShadow = `0 10px 24px rgba(0,0,0,0.18), 0 0 0 1px ${accent}33`;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "translateY(0)";
        e.currentTarget.style.boxShadow = "none";
      }}
    >
      {/* Delta badge — absolutely positioned in top-right corner so it never pushes title */}
      {delta && (
        <div style={{ position: "absolute", top: 10, right: 12 }}>
          <DeltaBadge delta={delta} invert={invertDelta} />
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", gap: 8, paddingRight: delta ? 56 : 0, minWidth: 0 }}>
        <div style={{
          width: 26, height: 26, borderRadius: 8,
          display: "flex", alignItems: "center", justifyContent: "center",
          background: `${accent}1f`, color: accent, flexShrink: 0,
        }}>
          {Icon && <Icon size={14} strokeWidth={2.2} />}
        </div>
        <span style={{
          fontSize: 12, color: "var(--text-muted)", fontWeight: 600,
          flex: 1, minWidth: 0,
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>{title}</span>
      </div>

      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 10 }}>
        <div style={{ fontSize: 26, fontWeight: 800, color: "var(--text-primary)", lineHeight: 1, letterSpacing: "-0.02em" }}>{value}</div>
        {sparkData && sparkData.length > 1 && (
          <div style={{ color: accent }}>
            <Sparkline data={sparkData} width={70} height={26} color={accent} />
          </div>
        )}
      </div>
      {sub && <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{sub}</div>}
    </div>
  );
}

function BarItem({ label, value, maxValue, accent }) {
  const pct = maxValue > 0 ? Math.round((value / maxValue) * 100) : 0;
  return (
    <div style={{ display: "grid", gap: 4 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--text-secondary)" }}>
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "70%" }}>{label}</span>
        <b style={{ color: "var(--text-primary)" }}>{value}</b>
      </div>
      <div style={{ height: 6, borderRadius: 4, background: "var(--bg-th)" }}>
        <div style={{ height: "100%", borderRadius: 4, width: `${pct}%`, background: accent, transition: "width 0.5s ease" }} />
      </div>
    </div>
  );
}

function StatusBadge({ status }) {
  const v = statusVars(status);
  return (
    <span style={{
      fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 6,
      background: v.bg, color: v.color, border: `1px solid ${v.border}`,
    }}>
      {statusLabel(status)}
    </span>
  );
}

function Avatar({ name, accent, size = 34 }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%", flexShrink: 0,
      background: accent+"26", border: `1px solid ${accent}55`,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: size <= 28 ? 11 : 13, fontWeight: 700, color: accent,
    }}>
      {initials(name)}
    </div>
  );
}

function SectionTitle({ children }) {
  return (
    <div style={{
      fontSize: 13, fontWeight: 700, color: "var(--text-secondary)",
      textTransform: "uppercase", letterSpacing: "0.06em",
      marginBottom: 12,
    }}>
      {children}
    </div>
  );
}

function Card({ children, style }) {
  return (
    <div style={{
      background: "var(--bg-card)", border: "1px solid var(--border)",
      borderRadius: 16, padding: 16, ...style,
    }}>
      {children}
    </div>
  );
}

/* ── Quick period button ─────────────────────────────────────── */
function PeriodBtn({ label, active, onClick }) {
  return (
    <button onClick={onClick} style={{
      padding: "5px 12px", borderRadius: 8, fontSize: 12, fontWeight: 600,
      cursor: "pointer", border: "1px solid",
      borderColor: active ? "#3acfd5" : "var(--border)",
      background: active ? "rgba(58,207,213,0.12)" : "var(--bg-card)",
      color: active ? "#3acfd5" : "var(--text-secondary)",
      transition: "all 0.15s",
    }}>
      {label}
    </button>
  );
}

/* ── Main Component ─────────────────────────────────────────── */
export default function Dashboard() {
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dashboard, setDashboard] = useState(null);
  const [from, setFrom] = useState(daysAgoYmd(30));
  const [to, setTo]     = useState(todayYmd());
  const [branchId, setBranchId] = useState("");
  const [activePeriod, setActivePeriod] = useState("30d");

  useEffect(() => {
    getBranches().then(d => setBranches(Array.isArray(d) ? d : [])).catch(()=>{});
    loadDashboard({ from: daysAgoYmd(30), to: todayYmd(), branch_id: "" });
  }, []);

  async function loadDashboard(params) {
    setLoading(true);
    try {
      const data = await getDirectorDashboard(params);
      setDashboard(data);
    } catch(e) {
      console.error("Dashboard load error:", e);
      setDashboard(null);
    } finally {
      setLoading(false);
    }
  }

  function applyPeriod(period) {
    setActivePeriod(period);
    let f, t = todayYmd();
    if (period==="today")  { f = todayYmd(); }
    else if (period==="7d") { f = daysAgoYmd(6); }
    else if (period==="30d") { f = daysAgoYmd(29); }
    else if (period==="month") { f = monthStartYmd(); }
    setFrom(f); setTo(t);
    loadDashboard({ from: f, to: t, branch_id: branchId });
  }

  function handleApply(e) {
    e.preventDefault();
    setActivePeriod("");
    loadDashboard({ from, to, branch_id: branchId });
  }

  const branchOptions = useMemo(() => {
    const items = branches.map(b => ({ value: String(b.id ?? ""), label: b.name || `Филиал ${b.id}` })).filter(x=>x.value);
    return [{ value:"", label:"Все филиалы" }, ...items];
  }, [branches]);

  const kpi           = dashboard?.kpi           || {};
  const prevKpi       = dashboard?.prev_kpi      || {};
  const series        = dashboard?.series        || {};
  const branchBookings = dashboard?.branch_bookings || [];
  const branchClients  = dashboard?.branch_clients  || [];
  const sources        = dashboard?.sources         || [];
  const recentClients  = dashboard?.recent_clients  || [];
  const recentBookings = dashboard?.recent_bookings || [];

  const deltaNewClients    = computeDelta(kpi.new_clients,        prevKpi.new_clients);
  const deltaBookings      = computeDelta(kpi.total_bookings,     prevKpi.total_bookings);
  const deltaCancelled     = computeDelta(kpi.cancelled_bookings, prevKpi.cancelled_bookings);
  const newClientsSeries   = (series.new_clients || []).map(d => d.value);
  const bookingsSeries     = (series.bookings    || []).map(d => d.value);

  const maxBranchB = Math.max(1, ...branchBookings.map(x=>x.bookings_count));
  const maxBranchC = Math.max(1, ...branchClients.map(x=>x.clients_count));
  const maxSource  = Math.max(1, ...sources.map(x=>x.clients_count));

  const todayStr = new Date().toLocaleDateString("ru-RU",{day:"numeric",month:"long",year:"numeric"});

  const inp = {
    padding: "7px 11px", borderRadius: 9,
    border: "1px solid var(--border-input)",
    background: "var(--bg-input)", color: "var(--text-primary)",
    fontSize: 12, outline: "none", width: "100%", boxSizing: "border-box",
  };

  return (
    <div style={{ padding: "18px 20px", maxWidth: 1400, margin: "0 auto", display: "grid", gap: 18 }}>

      {/* ── Header ── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
        <div>
          <div style={{ fontSize: 21, fontWeight: 800, color: "var(--text-primary)" }}>Дашборд</div>
          <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>{todayStr}</div>
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <PeriodBtn label="Сегодня"  active={activePeriod==="today"} onClick={()=>applyPeriod("today")} />
          <PeriodBtn label="7 дней"   active={activePeriod==="7d"}    onClick={()=>applyPeriod("7d")} />
          <PeriodBtn label="30 дней"  active={activePeriod==="30d"}   onClick={()=>applyPeriod("30d")} />
          <PeriodBtn label="Этот месяц" active={activePeriod==="month"} onClick={()=>applyPeriod("month")} />
        </div>
      </div>

      {/* ── Filter bar ── */}
      <Card style={{ padding: "12px 16px" }}>
        <form onSubmit={handleApply} style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end" }}>
          <div style={{ display: "grid", gap: 4, minWidth: 130, flex: "1 1 130px" }}>
            <div style={{ fontSize: 11, color: "var(--text-muted)" }}>С</div>
            <input type="date" style={inp} value={from} onChange={e=>{setFrom(e.target.value);setActivePeriod("");}} />
          </div>
          <div style={{ display: "grid", gap: 4, minWidth: 130, flex: "1 1 130px" }}>
            <div style={{ fontSize: 11, color: "var(--text-muted)" }}>По</div>
            <input type="date" style={inp} value={to} onChange={e=>{setTo(e.target.value);setActivePeriod("");}} />
          </div>
          <div style={{ display: "grid", gap: 4, minWidth: 160, flex: "2 1 160px" }}>
            <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Филиал</div>
            <select style={inp} value={branchId} onChange={e=>setBranchId(e.target.value)}>
              {branchOptions.map(o=><option key={o.value||"all"} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <button type="submit" style={{
            padding: "7px 18px", borderRadius: 9, border: "none", cursor: "pointer",
            background: "linear-gradient(90deg,#3acfd5,#6558f5)", color: "#fff",
            fontWeight: 700, fontSize: 12, whiteSpace: "nowrap", alignSelf: "flex-end",
          }}>
            Применить
          </button>
        </form>
      </Card>

      {/* ── Content ── */}
      {loading ? (
        <div style={{ display: "grid", gap: 18 }}>
          <SkeletonKpi count={7} />
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
            gap: 14,
          }}>
            <SkeletonCardGrid count={1} minW={260} gap={14} />
            <SkeletonCardGrid count={1} minW={260} gap={14} />
            <SkeletonCardGrid count={1} minW={260} gap={14} />
          </div>
        </div>
      ) : !dashboard ? (
        <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)", fontSize: 14 }}>
          Нет данных
        </div>
      ) : (
        <>
          {/* ── KPI Cards ── */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
            gap: 12,
          }}>
            <KpiCard Icon={Users}         title="Всего клиентов"     value={kpi.total_clients    || 0} accent="#3acfd5"
                     tooltip="Все клиенты в базе" />
            <KpiCard Icon={Sparkles}      title="Новых клиентов"     value={kpi.new_clients      || 0} accent="#6558f5"
                     sub="за период" delta={deltaNewClients} sparkData={newClientsSeries}
                     tooltip={`Зарегистрированы в выбранный период.\nСравнение с предыдущим периодом такой же длины.`} />
            <KpiCard Icon={Flame}         title="Активных клиентов"  value={kpi.active_clients   || 0} accent="#22c55e"
                     sub="с записями" tooltip="Клиенты с хотя бы одной записью за период" />
            <KpiCard Icon={Repeat}        title="Повторных клиентов" value={kpi.repeat_clients   || 0} accent="#ec4899"
                     tooltip="Клиенты с 2+ записями за период" />
            <KpiCard Icon={ClipboardList} title="Всего записей"      value={kpi.total_bookings   || 0} accent="#3b82f6"
                     delta={deltaBookings} sparkData={bookingsSeries}
                     tooltip="Все записи за период с динамикой по дням" />
            <KpiCard Icon={CalendarCheck} title="Записей сегодня"    value={kpi.today_bookings   || 0} accent="#f59e0b"
                     tooltip="Записи на сегодняшний день" />
            <KpiCard Icon={XCircle}       title="Отменённых"         value={kpi.cancelled_bookings || 0} accent="#ef4444"
                     delta={deltaCancelled} invertDelta
                     tooltip="Отменённые записи. Рост = плохо (красный)." />
          </div>

          {/* ── Daily bookings chart ── */}
          {series.bookings && series.bookings.length > 1 && (
            <AreaChart
              data={series.bookings}
              title="Записи по дням"
              accent="#3b82f6"
              height={220}
            />
          )}

          {/* ── Middle row: branches + sources ── */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 14 }}>
            {/* Branch bookings */}
            <Card>
              <SectionTitle>Записи по филиалам</SectionTitle>
              {branchBookings.length === 0 ? (
                <div style={{ fontSize: 13, color: "var(--text-muted)" }}>Нет данных</div>
              ) : (
                <div style={{ display: "grid", gap: 10 }}>
                  {branchBookings.map((x, i) => (
                    <BarItem
                      key={x.branch_id ?? i}
                      label={x.branch_name}
                      value={x.bookings_count}
                      maxValue={maxBranchB}
                      accent={ACCENT_PALETTE[i % ACCENT_PALETTE.length]}
                    />
                  ))}
                </div>
              )}
            </Card>

            {/* Branch clients */}
            <Card>
              <SectionTitle>Новые клиенты по филиалам</SectionTitle>
              {branchClients.length === 0 ? (
                <div style={{ fontSize: 13, color: "var(--text-muted)" }}>Нет данных</div>
              ) : (
                <div style={{ display: "grid", gap: 10 }}>
                  {branchClients.map((x, i) => (
                    <BarItem
                      key={x.branch_id ?? i}
                      label={x.branch_name}
                      value={x.clients_count}
                      maxValue={maxBranchC}
                      accent={ACCENT_PALETTE[(i+2) % ACCENT_PALETTE.length]}
                    />
                  ))}
                </div>
              )}
            </Card>

            {/* Sources */}
            <Card>
              <SectionTitle>Источники клиентов</SectionTitle>
              {sources.length === 0 ? (
                <div style={{ fontSize: 13, color: "var(--text-muted)" }}>Нет данных</div>
              ) : (
                <div style={{ display: "grid", gap: 10 }}>
                  {sources.map((x, i) => (
                    <BarItem
                      key={x.source ?? i}
                      label={x.source}
                      value={x.clients_count}
                      maxValue={maxSource}
                      accent={ACCENT_PALETTE[(i+4) % ACCENT_PALETTE.length]}
                    />
                  ))}
                </div>
              )}
            </Card>
          </div>

          {/* ── Bottom row: recent bookings + recent clients ── */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 14 }}>

            {/* Recent bookings */}
            <Card>
              <SectionTitle>Последние записи</SectionTitle>
              {recentBookings.length === 0 ? (
                <div style={{ fontSize: 13, color: "var(--text-muted)" }}>Нет данных</div>
              ) : (
                <div style={{ display: "grid", gap: 2 }}>
                  {recentBookings.slice(0, 6).map((b, i) => (
                    <div key={b.id} style={{
                      display: "flex", gap: 10, alignItems: "center",
                      padding: "6px 8px", borderRadius: 8,
                      transition: "background 0.15s",
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = "var(--bg-section)"}
                    onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>
                      <Avatar name={b.client_name || "?"} accent={ACCENT_PALETTE[i % ACCENT_PALETTE.length]} size={28} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{
                          fontSize: 13, fontWeight: 600, color: "var(--text-primary)",
                          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                        }}>
                          {b.client_name || "Без клиента"}
                        </div>
                        <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                          {formatDate(b.date)}
                          {b.start_time ? ` · ${formatTime(b.start_time)}` : ""}
                          {" · "}{b.branch_name}
                        </div>
                      </div>
                      <StatusBadge status={b.status || "booked"} />
                    </div>
                  ))}
                </div>
              )}
            </Card>

            {/* Recent clients */}
            <Card>
              <SectionTitle>Новые клиенты</SectionTitle>
              {recentClients.length === 0 ? (
                <div style={{ fontSize: 13, color: "var(--text-muted)" }}>Нет данных</div>
              ) : (
                <div style={{ display: "grid", gap: 2 }}>
                  {recentClients.slice(0, 6).map((c, i) => (
                    <div key={c.id} style={{
                      display: "flex", gap: 10, alignItems: "center",
                      padding: "6px 8px", borderRadius: 8,
                      transition: "background 0.15s",
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = "var(--bg-section)"}
                    onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>
                      <Avatar name={c.full_name || "?"} accent={ACCENT_PALETTE[(i+1) % ACCENT_PALETTE.length]} size={28} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{
                          fontSize: 13, fontWeight: 600, color: "var(--text-primary)",
                          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                        }}>
                          {c.full_name || "—"}
                        </div>
                        <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                          {formatPhone(c.phone)}
                          {" · "}{c.branch_name}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>

          </div>
        </>
      )}
    </div>
  );
}
