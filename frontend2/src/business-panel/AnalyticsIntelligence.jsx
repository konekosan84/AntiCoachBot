import { useEffect, useMemo, useState } from "react";
import {
  Activity, TrendingUp, TrendingDown, Minus, Sparkles, Zap, Brain,
  Flame, AlertTriangle, Users as UsersIcon, DollarSign,
} from "lucide-react";
import { apiFetch } from "../api/apiFetch.js";
import { getBranches } from "../api/branches.js";
import AreaChart from "../ui/AreaChart.jsx";
import { SkeletonKpi } from "../ui/Skeleton.jsx";

const DAYS_RU = ["Пн","Вт","Ср","Чт","Пт","Сб","Вс"];

function fmtMoney(n) {
  const v = Math.round(Number(n) || 0);
  return v.toLocaleString("ru-RU") + " ₽";
}
function fmtDate(ymd) {
  const s = String(ymd || "").slice(0, 10);
  const [y, m, d] = s.split("-").map(Number);
  if (!y) return s;
  const months = ["янв","фев","мар","апр","мая","июн","июл","авг","сен","окт","ноя","дек"];
  return `${d} ${months[m-1]}`;
}
function todayYmd() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}
function daysAgoYmd(n) {
  const d = new Date(); d.setDate(d.getDate() - n);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

export default function AnalyticsIntelligence() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [branches, setBranches] = useState([]);
  const [from, setFrom] = useState(daysAgoYmd(29));
  const [to, setTo]     = useState(todayYmd());
  const [branchId, setBranchId] = useState("");
  const [period, setPeriod] = useState("30d");

  useEffect(() => {
    getBranches().then(d => setBranches(Array.isArray(d) ? d : [])).catch(() => setBranches([]));
  }, []);

  useEffect(() => { load(); }, [from, to, branchId]);

  async function load() {
    setLoading(true);
    try {
      const params = new URLSearchParams({ from, to });
      if (branchId) params.set("branch_id", branchId);
      const d = await apiFetch(`/api/v1/analytics/intelligence?${params}`);
      setData(d);
    } catch (e) {
      console.error("analytics load", e);
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  function applyPeriod(p) {
    setPeriod(p);
    let f, t = todayYmd();
    if (p === "7d")        f = daysAgoYmd(6);
    else if (p === "30d")  f = daysAgoYmd(29);
    else if (p === "90d")  f = daysAgoYmd(89);
    else if (p === "ytd")  f = `${new Date().getFullYear()}-01-01`;
    setFrom(f); setTo(t);
  }

  if (loading) {
    return (
      <div style={{ padding: "18px 20px", maxWidth: 1400, margin: "0 auto", display: "grid", gap: 16 }}>
        <SkeletonKpi count={4} />
      </div>
    );
  }

  if (!data) {
    return (
      <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)" }}>
        Не удалось загрузить аналитику
      </div>
    );
  }

  const { health, kpi, series, heatmap, forecast, retention, top_clients, branches: branchStats, employees, insights, anomalies } = data;

  return (
    <div style={{ padding: "18px 20px", maxWidth: 1400, margin: "0 auto", display: "grid", gap: 16 }}>

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 10,
              background: "linear-gradient(135deg, #3acfd5, #6558f5)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <Brain size={18} color="#fff" />
            </div>
            <div>
              <div style={{ fontSize: 21, fontWeight: 800, color: "var(--text-primary)", letterSpacing: "-0.02em" }}>
                Intelligence
              </div>
              <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                Период: {fmtDate(from)} — {fmtDate(to)}
                {branchId && branches.find(b => Number(b.id)===Number(branchId)) ?
                  ` · ${branches.find(b => Number(b.id)===Number(branchId)).name}` : ""}
              </div>
            </div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
          {["7d","30d","90d","ytd"].map(p => (
            <PeriodBtn key={p} label={p === "7d" ? "7 дней" : p === "30d" ? "30 дней" : p === "90d" ? "90 дней" : "С начала года"}
              active={period === p} onClick={() => applyPeriod(p)} />
          ))}
          <select
            value={branchId} onChange={e => setBranchId(e.target.value)}
            style={{
              padding: "5px 10px", borderRadius: 8, fontSize: 12,
              border: "1px solid var(--border)", background: "var(--bg-card)",
              color: "var(--text-secondary)",
            }}
          >
            <option value="">Все филиалы</option>
            {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </div>
      </div>

      {/* Health Score Hero + Insights */}
      <div style={{ display: "grid", gridTemplateColumns: "minmax(300px, 380px) 1fr", gap: 16 }}>
        <HealthCard health={health} />
        <InsightsStack insights={insights} />
      </div>

      {/* KPI strip */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
        <Kpi
          icon={DollarSign}
          accent="#22c55e"
          label="Выручка"
          value={fmtMoney(kpi.revenue)}
          delta={kpi.revenue_delta}
          deltaLabel={`vs прошлый период (${fmtMoney(kpi.prev_revenue)})`}
        />
        <Kpi
          icon={Activity}
          accent="#3b82f6"
          label="Записей"
          value={kpi.total_bookings}
          sub={`${kpi.completed} выполнено · ${kpi.cancelled} отмен`}
        />
        <Kpi
          icon={UsersIcon}
          accent="#6558f5"
          label="Уникальных клиентов"
          value={kpi.unique_clients}
          sub={`средний чек ${fmtMoney(kpi.avg_check)}`}
        />
        <Kpi
          icon={AlertTriangle}
          accent={kpi.cancel_rate >= 20 ? "#ef4444" : kpi.cancel_rate >= 10 ? "#f59e0b" : "#22c55e"}
          label="Потери от отмен"
          value={fmtMoney(kpi.lost_revenue)}
          sub={`${kpi.cancel_rate}% отмен · ${kpi.no_show_rate}% не пришли`}
        />
      </div>

      {/* Revenue chart + forecast */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr minmax(260px, 320px)", gap: 16 }}>
        <AreaChart
          data={series.days.map((d, i) => ({ day: d, value: series.revenue[i] }))}
          title={`Выручка по дням · ${fmtMoney(kpi.revenue)}`}
          accent="#22c55e"
          height={240}
        />
        <ForecastCard forecast={forecast} />
      </div>

      {/* Heatmap + Retention */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr minmax(280px, 360px)", gap: 16 }}>
        <Heatmap heatmap={heatmap} />
        <RetentionCard retention={retention} />
      </div>

      {/* Top clients + Employees */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))", gap: 16 }}>
        <TopClients clients={top_clients} />
        <EmployeesRanking employees={employees} />
      </div>

      {/* Branches + Anomalies */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))", gap: 16 }}>
        <BranchesTable branches={branchStats} />
        <AnomaliesCard anomalies={anomalies} />
      </div>
    </div>
  );
}

/* ============== Components ============== */

function PeriodBtn({ label, active, onClick }) {
  return (
    <button onClick={onClick} style={{
      padding: "5px 12px", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer",
      border: "1px solid",
      borderColor: active ? "#3acfd5" : "var(--border)",
      background: active ? "rgba(58,207,213,0.12)" : "var(--bg-card)",
      color: active ? "#3acfd5" : "var(--text-secondary)",
    }}>{label}</button>
  );
}

function Card({ children, style }) {
  return (
    <div style={{
      background: "var(--bg-card)", border: "1px solid var(--border)",
      borderRadius: 16, padding: 18, ...style,
    }}>{children}</div>
  );
}

function SectionTitle({ children, icon: Icon, accent }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
      {Icon && (
        <div style={{
          width: 24, height: 24, borderRadius: 7,
          background: `${accent || "#3acfd5"}1f`, color: accent || "#3acfd5",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <Icon size={13} strokeWidth={2.2} />
        </div>
      )}
      <div style={{
        fontSize: 11, fontWeight: 700, color: "var(--text-secondary)",
        textTransform: "uppercase", letterSpacing: "0.06em",
      }}>{children}</div>
    </div>
  );
}

function HealthCard({ health }) {
  const score = health?.score || 0;
  const color = score >= 75 ? "#22c55e" : score >= 50 ? "#f59e0b" : "#ef4444";
  const label = score >= 75 ? "Отлично" : score >= 50 ? "Средне" : "Внимание";
  const r = 64;
  const c = 2 * Math.PI * r;
  const offset = c - (score / 100) * c;

  return (
    <Card style={{ display: "grid", gap: 14 }}>
      <SectionTitle icon={Zap} accent="#3acfd5">Health Score</SectionTitle>
      <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
        <svg width="160" height="160" viewBox="0 0 160 160">
          <circle cx="80" cy="80" r={r} fill="none" stroke="var(--bg-section)" strokeWidth="12" />
          <circle cx="80" cy="80" r={r} fill="none" stroke={color} strokeWidth="12"
            strokeDasharray={c} strokeDashoffset={offset} strokeLinecap="round"
            transform="rotate(-90 80 80)" style={{ transition: "stroke-dashoffset 0.8s ease" }} />
          <text x="80" y="78" textAnchor="middle" fontSize="38" fontWeight="800" fill="var(--text-primary)">{score}</text>
          <text x="80" y="100" textAnchor="middle" fontSize="11" fill={color} fontWeight="700"
                style={{ textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</text>
        </svg>

        <div style={{ flex: 1, display: "grid", gap: 8 }}>
          {(health?.components || []).map((c, i) => (
            <div key={i}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--text-secondary)", marginBottom: 3 }}>
                <span>{c.label}</span>
                <b style={{ color: "var(--text-primary)" }}>{c.score}</b>
              </div>
              <div style={{ height: 5, borderRadius: 4, background: "var(--bg-section)" }}>
                <div style={{
                  height: "100%", borderRadius: 4, width: `${c.score}%`,
                  background: c.score >= 75 ? "#22c55e" : c.score >= 50 ? "#f59e0b" : "#ef4444",
                  transition: "width 0.6s ease",
                }} />
              </div>
              <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 2 }}>{c.hint}</div>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}

function InsightsStack({ insights }) {
  const colors = {
    success: { bg: "rgba(34,197,94,0.10)",  border: "rgba(34,197,94,0.35)",  fg: "#86efac" },
    warning: { bg: "rgba(245,158,11,0.10)", border: "rgba(245,158,11,0.35)", fg: "#fcd34d" },
    danger:  { bg: "rgba(239,68,68,0.10)",  border: "rgba(239,68,68,0.35)",  fg: "#fca5a5" },
    info:    { bg: "rgba(58,207,213,0.10)", border: "rgba(58,207,213,0.35)", fg: "#7dd3fc" },
  };
  return (
    <Card>
      <SectionTitle icon={Sparkles} accent="#6558f5">AI-инсайты</SectionTitle>
      <div style={{ display: "grid", gap: 8 }}>
        {insights.map((it, i) => {
          const c = colors[it.type] || colors.info;
          return (
            <div key={i} style={{
              padding: "10px 12px", borderRadius: 12,
              background: c.bg, border: `1px solid ${c.border}`,
              display: "flex", gap: 12, alignItems: "flex-start",
            }}>
              <div style={{ fontSize: 22, lineHeight: 1, flexShrink: 0 }}>{it.icon}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: c.fg }}>{it.title}</div>
                <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 3, lineHeight: 1.5 }}>{it.text}</div>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function Kpi({ icon: Icon, accent, label, value, sub, delta, deltaLabel }) {
  return (
    <div style={{
      background: "var(--bg-card)", border: "1px solid var(--border)",
      borderRadius: 14, padding: "12px 14px",
      borderLeft: `3px solid ${accent}`,
      display: "grid", gap: 4,
    }}>
      <div style={{ display: "flex", gap: 7, alignItems: "center" }}>
        <div style={{
          width: 24, height: 24, borderRadius: 7,
          background: `${accent}1f`, color: accent,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          {Icon && <Icon size={13} strokeWidth={2.2} />}
        </div>
        <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>
          {label}
        </div>
      </div>
      <div style={{ fontSize: 22, fontWeight: 800, color: "var(--text-primary)", letterSpacing: "-0.02em", lineHeight: 1 }}>
        {value}
      </div>
      {delta !== undefined && (
        <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11 }}>
          {delta >= 0 ? <TrendingUp size={12} color="#22c55e" /> : <TrendingDown size={12} color="#ef4444" />}
          <b style={{ color: delta >= 0 ? "#22c55e" : "#ef4444" }}>{delta >= 0 ? "+" : ""}{delta}%</b>
          <span style={{ color: "var(--text-muted)" }}>{deltaLabel}</span>
        </div>
      )}
      {sub && <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{sub}</div>}
    </div>
  );
}

function ForecastCard({ forecast }) {
  const trendIcon = forecast.trend === "up" ? TrendingUp : forecast.trend === "down" ? TrendingDown : Minus;
  const trendColor = forecast.trend === "up" ? "#22c55e" : forecast.trend === "down" ? "#ef4444" : "#94a3b8";
  const trendLabel = forecast.trend === "up" ? "растёт" : forecast.trend === "down" ? "падает" : "стабильна";
  const Icon = trendIcon;

  return (
    <Card>
      <SectionTitle icon={TrendingUp} accent="#22c55e">Прогноз на 30 дней</SectionTitle>
      <div style={{ fontSize: 28, fontWeight: 800, color: "var(--text-primary)", letterSpacing: "-0.02em" }}>
        {fmtMoney(forecast.next_30_days)}
      </div>
      <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>
        В среднем {fmtMoney(forecast.per_day)} в день
      </div>
      <div style={{
        marginTop: 12, padding: "8px 12px", borderRadius: 10,
        background: `${trendColor}1a`, border: `1px solid ${trendColor}55`,
        display: "flex", alignItems: "center", gap: 8,
        fontSize: 12, color: trendColor, fontWeight: 600,
      }}>
        <Icon size={14} />
        Тренд: {trendLabel}
      </div>
      <div style={{ marginTop: 10, fontSize: 11, color: "var(--text-muted)", lineHeight: 1.4 }}>
        Линейная регрессия по выручке за выбранный период
      </div>
    </Card>
  );
}

function Heatmap({ heatmap }) {
  const values = heatmap.values;
  const max = heatmap.max;
  // Show only 06-23 hours for readability
  const hours = Array.from({ length: 18 }, (_, i) => i + 6);

  return (
    <Card>
      <SectionTitle icon={Flame} accent="#f59e0b">Тепловая карта загрузки</SectionTitle>
      <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 10 }}>
        День недели × час · Цвет = количество записей
      </div>
      <div style={{ overflowX: "auto" }}>
        <div style={{
          display: "grid",
          gridTemplateColumns: `30px repeat(${hours.length}, minmax(22px, 1fr))`,
          gap: 3,
          minWidth: 460,
        }}>
          <div />
          {hours.map(h => (
            <div key={h} style={{ fontSize: 9, color: "var(--text-muted)", textAlign: "center" }}>
              {h}
            </div>
          ))}
          {DAYS_RU.map((d, di) => (
            <>
              <div key={`l-${di}`} style={{ fontSize: 11, color: "var(--text-secondary)", fontWeight: 600, display: "flex", alignItems: "center" }}>
                {d}
              </div>
              {hours.map(h => {
                const v = values[di]?.[h] || 0;
                const intensity = max > 0 ? v / max : 0;
                const bg = v === 0 ? "var(--bg-section)" : `rgba(58,207,213,${0.10 + intensity * 0.85})`;
                return (
                  <div
                    key={`${di}-${h}`}
                    title={`${d} ${h}:00 — ${v}`}
                    style={{
                      height: 22, borderRadius: 4, background: bg,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 9, color: intensity > 0.5 ? "#0f172a" : "var(--text-muted)",
                      fontWeight: intensity > 0.3 ? 700 : 500,
                    }}
                  >
                    {v > 0 ? v : ""}
                  </div>
                );
              })}
            </>
          ))}
        </div>
      </div>
    </Card>
  );
}

function RetentionCard({ retention }) {
  const cohort = retention.cohort_size || 0;
  const ret30  = retention.returned_30d || 0;
  const ret60  = retention.returned_60d || 0;
  const rate30 = cohort > 0 ? Math.round((ret30 / cohort) * 100) : 0;
  const rate60 = cohort > 0 ? Math.round((ret60 / cohort) * 100) : 0;

  return (
    <Card>
      <SectionTitle icon={UsersIcon} accent="#ec4899">Удержание клиентов</SectionTitle>
      <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 10 }}>
        Из клиентов, посетивших в период
      </div>
      <div style={{ display: "grid", gap: 12 }}>
        <RetentionRow label="Вернулись за 30 дней" returned={ret30} total={cohort} rate={rate30} accent="#22c55e" />
        <RetentionRow label="Вернулись за 60 дней" returned={ret60} total={cohort} rate={rate60} accent="#3acfd5" />
      </div>
      <div style={{
        marginTop: 12, padding: "8px 10px", borderRadius: 8,
        background: "var(--bg-section)",
        fontSize: 11, color: "var(--text-muted)", lineHeight: 1.4,
      }}>
        💡 Удержание выше 40% за 60 дней — хороший знак. Ниже — стоит работать над клиентским опытом.
      </div>
    </Card>
  );
}

function RetentionRow({ label, returned, total, rate, accent }) {
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
        <span style={{ color: "var(--text-secondary)" }}>{label}</span>
        <b style={{ color: "var(--text-primary)" }}>{returned} / {total} · {rate}%</b>
      </div>
      <div style={{ height: 8, borderRadius: 4, background: "var(--bg-section)" }}>
        <div style={{ height: "100%", borderRadius: 4, width: `${rate}%`, background: accent, transition: "width 0.6s" }} />
      </div>
    </div>
  );
}

function TopClients({ clients }) {
  return (
    <Card>
      <SectionTitle icon={UsersIcon} accent="#3acfd5">Топ клиентов по LTV</SectionTitle>
      {clients.length === 0 ? (
        <div style={{ fontSize: 13, color: "var(--text-muted)" }}>Нет данных</div>
      ) : (
        <div style={{ display: "grid", gap: 4 }}>
          {clients.map((c, i) => (
            <div key={c.id} style={{
              display: "flex", gap: 10, alignItems: "center",
              padding: "8px 4px", borderBottom: i < clients.length - 1 ? "1px solid var(--border)" : "none",
            }}>
              <div style={{
                width: 24, height: 24, borderRadius: 6,
                background: i < 3 ? "linear-gradient(135deg, #f59e0b, #ec4899)" : "var(--bg-section)",
                color: i < 3 ? "#fff" : "var(--text-muted)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 11, fontWeight: 700, flexShrink: 0,
              }}>
                {i + 1}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: 13, fontWeight: 600, color: "var(--text-primary)",
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                }}>{c.name}</div>
                <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                  {c.visits} визитов · посл. {fmtDate(c.last_visit)}
                </div>
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#22c55e" }}>
                {fmtMoney(c.revenue)}
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function EmployeesRanking({ employees }) {
  const max = Math.max(1, ...employees.map(e => Number(e.revenue) || 0));
  return (
    <Card>
      <SectionTitle icon={UsersIcon} accent="#6558f5">Топ сотрудников</SectionTitle>
      {employees.length === 0 ? (
        <div style={{ fontSize: 13, color: "var(--text-muted)" }}>Нет данных</div>
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          {employees.map((e, i) => {
            const rev = Number(e.revenue) || 0;
            const pct = Math.round((rev / max) * 100);
            return (
              <div key={e.employee_id || i}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
                  <span style={{ color: "var(--text-primary)", fontWeight: 600 }}>{e.employee_name}</span>
                  <span><b style={{ color: "var(--text-primary)" }}>{fmtMoney(rev)}</b> <span style={{ color: "var(--text-muted)" }}>· {e.bookings}</span></span>
                </div>
                <div style={{ height: 6, borderRadius: 3, background: "var(--bg-section)" }}>
                  <div style={{ height: "100%", borderRadius: 3, width: `${pct}%`,
                    background: i === 0 ? "linear-gradient(90deg, #f59e0b, #ec4899)" : "#6558f5" }} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

function BranchesTable({ branches }) {
  return (
    <Card>
      <SectionTitle icon={Flame} accent="#3b82f6">Филиалы</SectionTitle>
      {branches.length === 0 ? (
        <div style={{ fontSize: 13, color: "var(--text-muted)" }}>Нет данных</div>
      ) : (
        <div style={{ display: "grid", gap: 4 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr auto auto auto", gap: 10, padding: "4px 8px", fontSize: 10, color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase" }}>
            <span>Филиал</span><span>Записи</span><span>Отмены</span><span>Выручка</span>
          </div>
          {branches.map((b, i) => (
            <div key={b.branch_id ?? i} style={{
              display: "grid", gridTemplateColumns: "1fr auto auto auto", gap: 10,
              padding: "8px", borderRadius: 8, background: "var(--bg-section)",
              fontSize: 12, alignItems: "center",
            }}>
              <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>{b.branch_name}</span>
              <span style={{ color: "var(--text-secondary)" }}>{b.bookings}</span>
              <span style={{ color: b.cancelled > 0 ? "#fca5a5" : "var(--text-muted)" }}>{b.cancelled}</span>
              <b style={{ color: "#22c55e" }}>{fmtMoney(b.revenue)}</b>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function AnomaliesCard({ anomalies }) {
  return (
    <Card>
      <SectionTitle icon={AlertTriangle} accent="#ef4444">Аномалии</SectionTitle>
      {anomalies.length === 0 ? (
        <div style={{ fontSize: 13, color: "var(--text-muted)", padding: 6 }}>
          ✓ Всё стабильно. Странных дней не найдено.
        </div>
      ) : (
        <div style={{ display: "grid", gap: 6 }}>
          {anomalies.map((a, i) => (
            <div key={i} style={{
              padding: "8px 10px", borderRadius: 8,
              background: a.type === "spike" ? "rgba(34,197,94,0.10)" : "rgba(239,68,68,0.10)",
              border: `1px solid ${a.type === "spike" ? "rgba(34,197,94,0.35)" : "rgba(239,68,68,0.35)"}`,
              display: "flex", alignItems: "center", gap: 10, fontSize: 12,
            }}>
              <span style={{ fontSize: 18 }}>{a.type === "spike" ? "📈" : "📉"}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, color: "var(--text-primary)" }}>{fmtDate(a.date)}</div>
                <div style={{ color: "var(--text-muted)", fontSize: 11 }}>
                  {a.bookings} записей (обычно ~{a.normal})
                </div>
              </div>
              <span style={{
                fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 999,
                background: a.type === "spike" ? "rgba(34,197,94,0.25)" : "rgba(239,68,68,0.25)",
                color: a.type === "spike" ? "#86efac" : "#fca5a5",
              }}>
                {a.type === "spike" ? "ПИК" : "ПРОВАЛ"}
              </span>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
