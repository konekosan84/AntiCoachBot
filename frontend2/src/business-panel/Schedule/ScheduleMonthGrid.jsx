import React, { useMemo } from "react";
import { toYmd, addDaysYmd, ruWeekdayShortMon, todayYmd } from "./scheduleDate.js";

function parseMinutes(hhmm) {
  const [h, m] = String(hhmm || "0:0").split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}
function durHours(start, end) {
  return Math.max(0, parseMinutes(end) - parseMinutes(start)) / 60;
}

function monthGridStart(anchorYmd) {
  const [y, m] = String(anchorYmd).slice(0, 10).split("-").map(Number);
  const first = new Date(y, m - 1, 1);
  const dow = first.getDay();
  first.setDate(first.getDate() + (dow === 0 ? -6 : 1 - dow));
  return toYmd(first);
}

export default function ScheduleMonthGrid({ anchorDate, shifts, onPickDate, branchId = "all", branchNameById }) {
  const start = useMemo(() => monthGridStart(anchorDate), [anchorDate]);
  const days  = useMemo(() => Array.from({ length: 42 }, (_, i) => addDaysYmd(start, i)), [start]);
  const today = useMemo(() => todayYmd(), []);
  const [ay, am] = String(anchorDate).slice(0, 10).split("-").map(Number);

  const getBranchName = bid => {
    const n = Number(bid);
    if (!Number.isFinite(n)) return "Филиал";
    if (branchNameById instanceof Map) return branchNameById.get(n) || `Филиал #${n}`;
    if (branchNameById && typeof branchNameById === "object") return branchNameById[n] || `Филиал #${n}`;
    return `Филиал #${n}`;
  };

  const statsByDay = useMemo(() => {
    const m = new Map();
    for (const s of shifts || []) {
      const d = String(s.date).slice(0, 10);
      const bid = Number(s.branch_id);
      const h = durHours(s.start_time, s.end_time);
      if (!m.has(d)) m.set(d, { totalCount: 0, totalHours: 0, byBranch: new Map() });
      const t = m.get(d);
      t.totalCount += 1;
      t.totalHours += h;
      const bb = t.byBranch.get(bid) || { count: 0, hours: 0 };
      bb.count += 1; bb.hours += h;
      t.byBranch.set(bid, bb);
      m.set(d, t);
    }
    return m;
  }, [shifts]);

  const showBranchBreakdown = String(branchId) === "all";

  return (
    <div style={{ padding: 16 }}>
      <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 12, color: "var(--text-primary)" }}>Месяц</div>

      {/* Weekday headers */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 6, marginBottom: 6 }}>
        {ruWeekdayShortMon.map(w => (
          <div key={w} style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600, padding: "0 4px" }}>{w}</div>
        ))}
      </div>

      {/* Calendar cells */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 6 }}>
        {days.map(d => {
          const [y, m, dayNum] = d.split("-").map(Number);
          const inMonth = y === ay && m === am;
          const isToday = d === today;
          const st = statsByDay.get(d) || { totalCount: 0, totalHours: 0, byBranch: new Map() };

          const branchPairs = showBranchBreakdown
            ? Array.from(st.byBranch.entries()).map(([bid, v]) => ({ bid, ...v })).sort((a, b) => b.count - a.count)
            : [];
          const top  = branchPairs.slice(0, 2);
          const rest = branchPairs.length - top.length;

          return (
            <button
              key={d}
              onClick={() => onPickDate?.(d)}
              title={isToday ? "Сегодня" : ""}
              style={{
                textAlign: "left", padding: "8px 10px", borderRadius: 12, cursor: "pointer",
                border: isToday ? "2px solid rgba(58,207,213,0.6)" : "1px solid var(--border)",
                background: isToday ? "rgba(58,207,213,0.08)" : "var(--bg-card)",
                opacity: inMonth ? 1 : 0.45,
                transition: "background 0.15s",
              }}
              onMouseEnter={ev => ev.currentTarget.style.background = isToday ? "rgba(58,207,213,0.12)" : "var(--bg-card-hover)"}
              onMouseLeave={ev => ev.currentTarget.style.background = isToday ? "rgba(58,207,213,0.08)" : "var(--bg-card)"}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <span style={{ fontWeight: 600, color: "var(--text-primary)", fontSize: 13 }}>{dayNum}</span>
                  {isToday && <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#3acfd5", display: "inline-block" }} />}
                </div>
                <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                  {st.totalCount > 0 ? `${st.totalCount} смен` : "—"}
                </span>
              </div>

              {st.totalCount > 0 && (
                <>
                  <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>{st.totalHours.toFixed(1)} ч</div>
                  {showBranchBreakdown && branchPairs.length > 0 && (
                    <div style={{ marginTop: 4, display: "flex", flexDirection: "column", gap: 2 }}>
                      {top.map(b => (
                        <div key={b.bid} style={{ display: "flex", justifyContent: "space-between", gap: 4, fontSize: 11, color: "var(--text-secondary)" }}>
                          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{getBranchName(b.bid)}</span>
                          <span style={{ flexShrink: 0, color: "var(--text-primary)" }}>{b.count}·{b.hours.toFixed(1)}ч</span>
                        </div>
                      ))}
                      {rest > 0 && <div style={{ fontSize: 11, color: "var(--text-muted)" }}>+ ещё {rest}</div>}
                    </div>
                  )}
                </>
              )}
              {st.totalCount === 0 && (
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>нет смен</div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
