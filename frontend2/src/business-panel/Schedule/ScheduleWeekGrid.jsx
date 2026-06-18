import React, { useMemo } from "react";
import { ruWeekdayShortMon } from "./scheduleDate.js";

function todayYmd() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

function parseMinutes(hhmm) {
  const [h, m] = String(hhmm || "0:0").split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}
function durHours(start, end) {
  return Math.max(0, parseMinutes(end) - parseMinutes(start)) / 60;
}

export default function ScheduleWeekGrid({ dates, employees, shifts, branchNameById, onAddShift, onShiftClick }) {
  const index = useMemo(() => {
    const cell   = new Map();
    const totals = new Map();
    for (const s of shifts || []) {
      const d = String(s.date).slice(0, 10);
      const k = `${d}|${s.employee_id}`;
      if (!cell.has(k)) cell.set(k, []);
      cell.get(k).push(s);
      const emp = Number(s.employee_id);
      if (!totals.has(emp)) totals.set(emp, { count: 0, hours: 0 });
      const t = totals.get(emp);
      t.count += 1;
      t.hours += durHours(s.start_time, s.end_time);
      totals.set(emp, t);
    }
    for (const [k, arr] of cell.entries()) {
      arr.sort((a, b) => String(a.start_time).localeCompare(String(b.start_time)));
      cell.set(k, arr);
    }
    return { cell, totals };
  }, [shifts]);

  return (
    <div style={{ padding: 16, overflowX: "auto" }}>
      <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 12, color: "var(--text-primary)" }}>Неделя</div>

      {/* min-width: 820px fits in 1146px content (1366px - 220px sidebar) */}
      <div
        style={{
          minWidth: 820,
          display: "grid",
          gridTemplateColumns: `180px repeat(${dates.length}, minmax(90px, 1fr))`,
        }}
      >
        {/* Header row */}
        <div style={{ padding: "6px 8px", fontSize: 12, color: "var(--text-muted)", fontWeight: 600 }}>Сотрудник</div>
        {dates.map((d, i) => {
          const isToday = d === todayYmd();
          return (
            <div key={d} style={{
              padding: "6px 8px", fontSize: 12, fontWeight: 700,
              color: isToday ? "#3acfd5" : "var(--text-primary)",
              borderBottom: isToday ? "2px solid #3acfd5" : undefined,
              textAlign: "left",
            }}>
              {isToday && "● "}
              {ruWeekdayShortMon[i]}{" "}
              <span style={{ color: isToday ? "#3acfd5" : "var(--text-muted)", fontWeight: 600 }}>{d.slice(5)}</span>
            </div>
          );
        })}

        {/* Employee rows */}
        {employees.map(e => {
          const t = index.totals.get(Number(e.id)) || { count: 0, hours: 0 };
          return (
            <React.Fragment key={e.id}>
              <div style={{ padding: "8px", borderTop: "1px solid var(--border)" }}>
                <div style={{ fontWeight: 600, fontSize: 13, color: "var(--text-primary)" }}>{e.name}</div>
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
                  Смен: {t.count} · {t.hours.toFixed(1)} ч
                </div>
              </div>

              {dates.map(d => {
                const key  = `${d}|${e.id}`;
                const list = index.cell.get(key) || [];
                const isToday = d === todayYmd();
                const cellBg = isToday ? "rgba(58,207,213,0.06)" : "var(--bg-card)";
                return (
                  <div
                    key={key}
                    style={{
                      padding: "6px", borderTop: "1px solid var(--border)",
                      borderLeft: isToday ? "2px solid #3acfd5" : "1px solid var(--border)",
                      cursor: "pointer", minHeight: 56,
                      background: cellBg,
                      transition: "background 0.15s",
                    }}
                    onClick={() => onAddShift?.({ date: d, employee_id: e.id, branch_id: null })}
                    title="Клик: добавить смену"
                    onMouseEnter={ev => ev.currentTarget.style.background = "var(--bg-card-hover)"}
                    onMouseLeave={ev => ev.currentTarget.style.background = cellBg}
                  >
                    {list.length === 0 ? (
                      <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 6, textAlign: "center" }}>—</div>
                    ) : (
                      <div style={{ display: "grid", gap: 4 }}>
                        {list.map(s => {
                          const branch = branchNameById?.get?.(Number(s.branch_id)) || `Филиал #${s.branch_id}`;
                          return (
                            <button
                              key={s.id}
                              style={{
                                textAlign: "left", width: "100%", padding: "5px 7px", borderRadius: 8,
                                border: "1px solid var(--border)",
                                background: "var(--bg-card-elevated)",
                                cursor: "pointer", fontSize: 12, color: "var(--text-primary)",
                              }}
                              onClick={ev => { ev.stopPropagation(); onShiftClick?.(s); }}
                              onMouseEnter={ev => ev.currentTarget.style.background = "var(--bg-card-hover)"}
                              onMouseLeave={ev => ev.currentTarget.style.background = "var(--bg-card-elevated)"}
                            >
                              <div style={{ fontWeight: 700 }}>{String(s.start_time).slice(0,5)}–{String(s.end_time).slice(0,5)}</div>
                              <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 1 }}>{branch}</div>
                              {s.notes && <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 1, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{s.notes}</div>}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}
