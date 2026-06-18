import React, { useEffect, useMemo, useState } from "react";
import { Repeat, Calendar, AlertCircle, Layers } from "lucide-react";
import {
  createShift, updateShift, deleteShift,
  updateShiftScope, getShiftSeries,
} from "../../api/schedule.js";
import { isYmd, todayYmd } from "./scheduleDate.js";

const DAYS = [
  { v: 0, l: "Пн" }, { v: 1, l: "Вт" }, { v: 2, l: "Ср" }, { v: 3, l: "Чт" },
  { v: 4, l: "Пт" }, { v: 5, l: "Сб" }, { v: 6, l: "Вс" },
];

function plusDays(ymd, n) {
  const d = new Date(ymd + "T00:00:00"); d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}
function ruDate(ymd) {
  if (!ymd) return "";
  const m = ["янв","фев","мар","апр","мая","июн","июл","авг","сен","окт","ноя","дек"];
  const [_, mo, da] = ymd.split("-").map(Number);
  return `${da} ${m[mo-1]}`;
}
function isoWeekdayFromYmd(ymd) {
  const d = new Date(ymd + "T00:00:00");
  return (d.getDay() + 6) % 7; // 0=Mon..6=Sun
}
function pluralShifts(n) {
  const a = Math.abs(n) % 100, b = a % 10;
  if (a > 10 && a < 20) return "смен";
  if (b > 1 && b < 5)   return "смены";
  if (b === 1)          return "смену";
  return "смен";
}

const fieldStyle = {
  width: "100%", padding: "9px 11px", borderRadius: 10,
  border: "1px solid var(--border-input)",
  background: "var(--bg-input)", color: "var(--text-primary)",
  fontSize: 13, outline: "none", boxSizing: "border-box",
};

export default function ShiftSidePanel({ open, mode, initial, branches = [], employees = [], onClose, onSaved }) {
  const [saving, setSaving]   = useState(false);
  const [err, setErr]         = useState("");
  const [okMsg, setOkMsg]     = useState("");
  const [series, setSeries]   = useState(null); // {series_id,total,first_date,last_date,weekdays}
  const [editScope, setEditScope] = useState("one"); // for edit-mode of series shift

  const [form, setForm] = useState({
    id: null, date: todayYmd(), branch_id: "", employee_id: "",
    start_time: "10:00", end_time: "19:00", notes: "",
  });

  // Repeat block (only meaningful in create mode)
  const [repeatOn, setRepeatOn] = useState(false);
  const [repeat, setRepeat] = useState({
    weekdays: [0,1,2,3,4], // Mon-Fri by default
    date_to: plusDays(todayYmd(), 27), // 4 weeks
  });

  useEffect(() => {
    if (!open) return;
    const src = initial || {};
    setErr(""); setOkMsg(""); setSeries(null); setEditScope("one");
    setRepeatOn(false);
    const d = isYmd(src.date) ? src.date : (src.date ? String(src.date).slice(0, 10) : todayYmd());
    setForm({
      id: src.id ?? null,
      date: d,
      branch_id:   src.branch_id   ?? "",
      employee_id: src.employee_id ?? "",
      start_time:  src.start_time  ? String(src.start_time).slice(0,5) : "10:00",
      end_time:    src.end_time    ? String(src.end_time).slice(0,5)   : "19:00",
      notes:       src.notes       ?? "",
    });
    // Init repeat defaults around the picked date
    setRepeat({ weekdays: [isoWeekdayFromYmd(d)], date_to: plusDays(d, 27) });

    // If editing existing shift — fetch series info
    if (mode === "edit" && src.id && src.series_id != null) {
      getShiftSeries(src.id).then(setSeries).catch(() => {});
    }
  }, [open, initial, mode]);

  const title = useMemo(() => mode === "edit" ? "Смена" : "Новая смена", [mode]);

  // Filter employees by branch
  const filteredEmployees = useMemo(() => {
    if (!form.branch_id) return employees;
    const bid = Number(form.branch_id);
    return employees.filter(emp => Array.isArray(emp.branches)
      && emp.branches.some(b => Number(b.id ?? b.branch_id) === bid));
  }, [employees, form.branch_id]);

  useEffect(() => {
    if (!form.branch_id || !form.employee_id) return;
    const stillValid = filteredEmployees.some(e => Number(e.id) === Number(form.employee_id));
    if (!stillValid) setForm(p => ({ ...p, employee_id: "" }));
  }, [form.branch_id, filteredEmployees]);

  // Live count of how many shifts the series will create
  const seriesPreview = useMemo(() => {
    if (!repeatOn) return null;
    if (!form.date || !repeat.date_to || form.date > repeat.date_to) return { count: 0, weeks: 0 };
    if (repeat.weekdays.length === 0) return { count: 0, weeks: 0 };
    const wdSet = new Set(repeat.weekdays);
    const start = new Date(form.date + "T00:00:00");
    const end   = new Date(repeat.date_to + "T00:00:00");
    let n = 0;
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const wd = (d.getDay() + 6) % 7;
      if (wdSet.has(wd)) n += 1;
    }
    const weeks = Math.round(((end - start) / 86400000 + 1) / 7);
    return { count: n, weeks };
  }, [repeatOn, repeat.weekdays, repeat.date_to, form.date]);

  if (!open) return null;

  function toggleWeekday(v) {
    setRepeat(r => {
      const has = r.weekdays.includes(v);
      const next = has ? r.weekdays.filter(w => w !== v) : [...r.weekdays, v].sort((a,b)=>a-b);
      return { ...r, weekdays: next };
    });
  }

  async function onSave() {
    setErr(""); setOkMsg("");
    if (!isYmd(form.date))                                return setErr("Укажите дату.");
    if (!form.branch_id)                                  return setErr("Выберите филиал.");
    if (!form.employee_id)                                return setErr("Выберите сотрудника.");
    if (!form.start_time || !form.end_time)               return setErr("Укажите время.");
    if (String(form.end_time) <= String(form.start_time)) return setErr("Конец должен быть позже начала.");

    const base = {
      branch_id:   Number(form.branch_id),
      employee_id: Number(form.employee_id),
      start_time:  String(form.start_time),
      end_time:    String(form.end_time),
      notes:       form.notes ? String(form.notes) : null,
    };

    setSaving(true);
    try {
      // ── EDIT ──
      if (mode === "edit" && form.id) {
        if (series && editScope !== "one") {
          const r = await updateShiftScope(form.id, editScope, {
            start_time: base.start_time, end_time: base.end_time, notes: base.notes,
          });
          setOkMsg(`✓ Обновлено смен: ${r.updated}`);
          setTimeout(() => { onSaved?.(); onClose?.(); }, 600);
          return;
        }
        await updateShift(form.id, { ...base, date: form.date });
        onSaved?.(); onClose?.();
        return;
      }

      // ── CREATE: single ──
      if (!repeatOn) {
        await createShift({ ...base, date: form.date });
        onSaved?.(); onClose?.();
        return;
      }

      // ── CREATE: series ──
      if (repeat.weekdays.length === 0) return setErr("Выберите хотя бы один день недели.");
      if (!isYmd(repeat.date_to))       return setErr("Укажите дату «до».");
      if (form.date > repeat.date_to)   return setErr("Дата «до» должна быть позже даты начала.");

      const r = await createShift({
        ...base,
        repeat: { weekdays: repeat.weekdays, date_from: form.date, date_to: repeat.date_to },
      });
      if (r.created === 0 && r.skipped === 0) {
        setErr("Ничего не создано — проверьте период и дни недели.");
      } else if (r.created > 0 && r.skipped === 0) {
        setOkMsg(`✓ Создано ${r.created} ${pluralShifts(r.created)} с ${ruDate(form.date)} по ${ruDate(repeat.date_to)}.`);
      } else {
        const dates = (r.conflicts || []).slice(0, 4).map(c => ruDate(c.date)).join(", ");
        const more = (r.conflicts || []).length > 4 ? " и ещё…" : "";
        setOkMsg(`✓ Создано ${r.created} ${pluralShifts(r.created)}. Пропущено ${r.skipped} (уже есть смены в эти даты: ${dates}${more}).`);
      }
      setTimeout(() => { onSaved?.(); onClose?.(); }, 1300);
    } catch (e) {
      if (e?.status === 409 && e?.payload?.overlap) {
        const o = e.payload.overlap;
        setErr(`Пересечение со сменой ${String(o.start_time).slice(0,5)}–${String(o.end_time).slice(0,5)} в этот день.`);
      } else {
        setErr(e?.message || "Ошибка сохранения");
      }
    } finally {
      setSaving(false);
    }
  }

  async function onRemove() {
    if (!form.id) return;
    setErr(""); setOkMsg("");
    if (series && editScope !== "one") {
      const label = editScope === "future"
        ? `все будущие смены этой серии (включая ${ruDate(form.date)})`
        : `всю серию (${series.total} смен)`;
      if (!confirm(`Удалить ${label}?`)) return;
    } else {
      if (!confirm("Удалить эту смену?")) return;
    }
    setSaving(true);
    try {
      const r = await deleteShift(form.id, series ? editScope : "one");
      setOkMsg(`✓ Удалено смен: ${r.deleted || 1}`);
      setTimeout(() => { onSaved?.(); onClose?.(); }, 500);
    } catch (e) {
      setErr(e?.message || "Ошибка удаления");
    } finally { setSaving(false); }
  }

  const set = key => e => setForm(p => ({ ...p, [key]: e.target.value }));

  return (
    <>
      <div style={{ position: "fixed", inset: 0, zIndex: 49, background: "rgba(0,0,0,0.4)" }} onClick={onClose} />
      <div style={{
        position: "fixed", right: 0, top: 0, height: "100vh", width: 460, maxWidth: "94vw",
        zIndex: 50, overflowY: "auto",
        background: "var(--bg-panel)", borderLeft: "1px solid var(--border)",
        boxShadow: "-14px 0 32px rgba(0,0,0,0.3)", padding: 18,
      }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <div style={{ fontSize: 17, fontWeight: 700, color: "var(--text-primary)" }}>{title}</div>
          <button style={{
            padding: "6px 12px", borderRadius: 8, border: "1px solid var(--border)",
            background: "var(--bg-card)", color: "var(--text-secondary)", fontSize: 12, cursor: "pointer",
          }} onClick={onClose}>Закрыть</button>
        </div>

        {/* Series banner (edit mode) */}
        {mode === "edit" && series && series.series_id && (
          <div style={{
            marginBottom: 12, padding: 12, borderRadius: 12,
            border: "1px solid rgba(124,109,242,0.35)", background: "rgba(124,109,242,0.08)",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12, fontWeight: 700, color: "#c7c0ff", marginBottom: 8 }}>
              <Layers size={13}/> Часть серии · {series.total} {pluralShifts(series.total)}
              <span style={{ color: "var(--text-muted)", fontWeight: 500 }}>· до {ruDate(series.last_date)}</span>
            </div>
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 8 }}>
              Применить изменения к:
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              {[
                { v: "one",    l: "Только эту" },
                { v: "future", l: "Эту и будущие" },
                { v: "all",    l: "Всю серию" },
              ].map(opt => (
                <button key={opt.v} onClick={() => setEditScope(opt.v)} style={{
                  flex: 1, padding: "7px 6px", borderRadius: 8, fontSize: 11, fontWeight: 600,
                  cursor: "pointer", border: "1px solid",
                  borderColor: editScope === opt.v ? "#7c6df2" : "var(--border)",
                  background:  editScope === opt.v ? "rgba(124,109,242,0.20)" : "var(--bg-card)",
                  color: editScope === opt.v ? "#fff" : "var(--text-secondary)",
                }}>{opt.l}</button>
              ))}
            </div>
          </div>
        )}

        {err && (
          <div style={{ marginBottom: 12, padding: "10px 12px", borderRadius: 10,
            border: "1px solid rgba(239,68,68,0.35)", background: "rgba(239,68,68,0.10)",
            fontSize: 13, color: "#fca5a5", display: "flex", alignItems: "flex-start", gap: 8,
          }}>
            <AlertCircle size={15} style={{ flexShrink: 0, marginTop: 1 }}/>
            <div style={{ whiteSpace: "pre-line" }}>{err}</div>
          </div>
        )}

        {okMsg && (
          <div style={{ marginBottom: 12, padding: "10px 12px", borderRadius: 10,
            border: "1px solid rgba(34,197,94,0.35)", background: "rgba(34,197,94,0.10)",
            fontSize: 13, color: "#86efac",
          }}>{okMsg}</div>
        )}

        <div style={{ display: "grid", gap: 12 }}>
          {/* Date */}
          <label style={{ display: "grid", gap: 4 }}>
            <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
              {repeatOn ? "Начало серии (первый день)" : "Дата"}
            </div>
            <input type="date" style={fieldStyle} value={form.date} onChange={set("date")} disabled={mode === "edit"} />
          </label>

          {/* Branch */}
          <label style={{ display: "grid", gap: 4 }}>
            <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Филиал</div>
            <select style={fieldStyle} value={form.branch_id} onChange={set("branch_id")} disabled={mode === "edit"}>
              <option value="">Выбрать…</option>
              {branches.map(b => <option key={b.id} value={b.id}>{b.name || `Филиал #${b.id}`}</option>)}
            </select>
          </label>

          {/* Employee */}
          <label style={{ display: "grid", gap: 4 }}>
            <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Сотрудник</div>
            <select style={fieldStyle} value={form.employee_id} onChange={set("employee_id")} disabled={!form.branch_id || mode === "edit"}>
              <option value="">{form.branch_id ? "Выбрать…" : "Сначала выберите филиал"}</option>
              {filteredEmployees.map(emp => <option key={emp.id} value={emp.id}>{emp.name || `#${emp.id}`}</option>)}
            </select>
            {form.branch_id && filteredEmployees.length === 0 && (
              <div style={{ fontSize: 11, color: "#fca5a5", marginTop: 4 }}>
                Нет сотрудников, привязанных к этому филиалу
              </div>
            )}
          </label>

          {/* Times */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <label style={{ display: "grid", gap: 4 }}>
              <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Начало</div>
              <input type="time" style={fieldStyle} value={form.start_time} onChange={set("start_time")} />
            </label>
            <label style={{ display: "grid", gap: 4 }}>
              <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Конец</div>
              <input type="time" style={fieldStyle} value={form.end_time} onChange={set("end_time")} />
            </label>
          </div>

          {/* REPEAT — only for create */}
          {mode !== "edit" && (
            <div style={{
              background: "var(--bg-card)", border: "1px solid var(--border)",
              borderRadius: 12, padding: 12,
            }}>
              <label style={{ display: "flex", alignItems: "center", gap: 9, cursor: "pointer", marginBottom: repeatOn ? 12 : 0 }}>
                <input type="checkbox" checked={repeatOn} onChange={e => setRepeatOn(e.target.checked)}
                       style={{ width: 16, height: 16, accentColor: "#7c6df2", cursor: "pointer" }} />
                <Repeat size={15} style={{ color: "#a99cff" }}/>
                <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>
                  Повторять каждую неделю
                </span>
              </label>

              {repeatOn && (
                <>
                  <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 6 }}>
                    Дни недели
                  </div>
                  <div style={{ display: "flex", gap: 6, marginBottom: 12, flexWrap: "wrap" }}>
                    {DAYS.map(d => {
                      const on = repeat.weekdays.includes(d.v);
                      return (
                        <button key={d.v} onClick={() => toggleWeekday(d.v)} style={{
                          width: 38, height: 32, borderRadius: 8, fontSize: 12, fontWeight: 700,
                          cursor: "pointer", border: "1px solid",
                          borderColor: on ? "#7c6df2" : "var(--border)",
                          background:  on ? "linear-gradient(135deg,#7c6df2,#3acfd5)" : "var(--bg-input)",
                          color: on ? "#fff" : "var(--text-secondary)",
                        }}>{d.l}</button>
                      );
                    })}
                  </div>

                  <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 6 }}>
                    Повторять до
                  </div>
                  <input type="date" style={fieldStyle} value={repeat.date_to}
                         min={form.date}
                         onChange={e => setRepeat(r => ({ ...r, date_to: e.target.value }))} />

                  <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
                    {[
                      { l: "Неделя",  n: 6   },
                      { l: "2 нед.",  n: 13  },
                      { l: "Месяц",   n: 27  },
                      { l: "3 мес.",  n: 89  },
                    ].map(p => (
                      <button key={p.l} onClick={() => setRepeat(r => ({ ...r, date_to: plusDays(form.date, p.n) }))} style={{
                        padding: "4px 9px", borderRadius: 7, fontSize: 11, fontWeight: 600,
                        cursor: "pointer", border: "1px solid var(--border)",
                        background: "var(--bg-input)", color: "var(--text-secondary)",
                      }}>{p.l}</button>
                    ))}
                  </div>

                  {seriesPreview && (
                    <div style={{
                      marginTop: 12, padding: "9px 11px", borderRadius: 9,
                      background: "rgba(58,207,213,0.10)", border: "1px solid rgba(58,207,213,0.30)",
                      fontSize: 12, color: "#7eebf0", display: "flex", alignItems: "center", gap: 7,
                    }}>
                      <Calendar size={13}/>
                      {seriesPreview.count > 0
                        ? <>Создастся <b style={{ color: "#fff" }}>{seriesPreview.count}</b> {pluralShifts(seriesPreview.count)} с {ruDate(form.date)} по {ruDate(repeat.date_to)}</>
                        : <>Ни одного дня не подходит — выберите дни недели</>}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* Notes */}
          <label style={{ display: "grid", gap: 4 }}>
            <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Комментарий</div>
            <textarea rows={3} style={{ ...fieldStyle, resize: "vertical" }} value={form.notes} onChange={set("notes")} />
          </label>

          {/* Buttons */}
          <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
            <button style={{
              flex: 1, padding: "11px 0", borderRadius: 10, border: "none",
              background: saving ? "var(--bg-card)" : "linear-gradient(90deg, #3acfd5, #6558f5)",
              color: "#fff", fontWeight: 700, fontSize: 13, cursor: saving ? "wait" : "pointer",
              opacity: saving ? 0.7 : 1,
            }} disabled={saving} onClick={onSave}>
              {saving ? "Сохраняю…"
                : mode === "edit" ? "Сохранить"
                : repeatOn && seriesPreview?.count > 0 ? `Создать серию (${seriesPreview.count} ${pluralShifts(seriesPreview.count)})`
                : "Создать смену"}
            </button>

            {mode === "edit" && form.id && (
              <button style={{
                padding: "11px 14px", borderRadius: 10,
                border: "1px solid rgba(239,68,68,0.4)", background: "rgba(239,68,68,0.12)",
                color: "#fca5a5", fontSize: 13, cursor: saving ? "wait" : "pointer",
              }} disabled={saving} onClick={onRemove}>Удалить</button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
