import React, { useMemo } from "react";

function parseMinutes(hhmm) {
  const [h, m] = String(hhmm || "0:0").split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}
function durHours(start, end) {
  return Math.max(0, parseMinutes(end) - parseMinutes(start)) / 60;
}

export default function ScheduleDayGrid({ date, employees, shifts, branchNameById, onAddShift, onShiftClick }) {
  const byEmp = useMemo(() => {
    const m = new Map();
    for (const e of employees) m.set(Number(e.id), []);
    for (const s of shifts || []) {
      const d = String(s.date).slice(0, 10);
      if (d !== date) continue;
      const k = Number(s.employee_id);
      if (!m.has(k)) m.set(k, []);
      m.get(k).push(s);
    }
    for (const [k, arr] of m.entries()) {
      arr.sort((a, b) => String(a.start_time).localeCompare(String(b.start_time)));
      m.set(k, arr);
    }
    return m;
  }, [employees, shifts, date]);

  return (
    <div style={{ padding: 16 }}>
      <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 12, color: "var(--text-primary)" }}>
        День: {date}
      </div>

      <div style={{ display: "grid", gap: 10 }}>
        {employees.map(e => {
          const list = byEmp.get(Number(e.id)) || [];
          const totalHours = list.reduce((sum, s) => sum + durHours(s.start_time, s.end_time), 0);
          return (
            <div key={e.id} style={{ borderRadius: 16, border: "1px solid var(--border)", background: "var(--bg-card-elevated)", padding: 14 }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
                <div>
                  <div style={{ fontWeight: 600, color: "var(--text-primary)" }}>{e.name}</div>
                  <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
                    Смен: {list.length} · {totalHours.toFixed(1)} ч
                  </div>
                </div>
                <button
                  style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-card)", color: "var(--text-secondary)", fontSize: 12, cursor: "pointer" }}
                  onClick={() => onAddShift?.({ date, employee_id: e.id, branch_id: null })}
                >
                  + смена
                </button>
              </div>

              {list.length === 0 ? (
                <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 10 }}>Смен нет</div>
              ) : (
                <div style={{ marginTop: 10, display: "grid", gap: 6 }}>
                  {list.map(s => {
                    const branch = branchNameById?.get?.(Number(s.branch_id)) || `Филиал #${s.branch_id}`;
                    return (
                      <button
                        key={s.id}
                        style={{
                          textAlign: "left", padding: "10px 12px", borderRadius: 10,
                          border: "1px solid var(--border)", background: "var(--bg-card)",
                          cursor: "pointer", color: "var(--text-primary)",
                        }}
                        onClick={() => onShiftClick?.(s)}
                        onMouseEnter={ev => ev.currentTarget.style.background = "var(--bg-card-hover)"}
                        onMouseLeave={ev => ev.currentTarget.style.background = "var(--bg-card)"}
                      >
                        <div style={{ fontWeight: 700, fontSize: 14 }}>{String(s.start_time).slice(0,5)}–{String(s.end_time).slice(0,5)}</div>
                        <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>{branch}</div>
                        {s.notes && <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>{s.notes}</div>}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
