import { useEffect, useMemo, useState } from "react";
import {
  CalendarPlus, Trash2, Plus, Wand2, X, Loader2, Info,
  Pencil, Check as CheckIcon, Lightbulb,
} from "lucide-react";
import { apiFetch } from "../../api/apiFetch.js";
import { useToast } from "../../helpers/ToastContext.jsx";

const DAYS = [
  { v: 0, l: "Пн", lLong: "понедельник" }, { v: 1, l: "Вт", lLong: "вторник" },
  { v: 2, l: "Ср", lLong: "среду" },       { v: 3, l: "Чт", lLong: "четверг" },
  { v: 4, l: "Пт", lLong: "пятницу" },     { v: 5, l: "Сб", lLong: "субботу" },
  { v: 6, l: "Вс", lLong: "воскресенье" },
];

function todayYmd() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}
function plusDaysYmd(n) {
  const d = new Date(); d.setDate(d.getDate()+n);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}
function fmtRangeDates(from, to) {
  if (!from || !to) return "";
  const months = ["янв","фев","мар","апр","мая","июн","июл","авг","сен","окт","ноя","дек"];
  const [, mf, df] = from.split("-").map(Number);
  const [, mt, dt] = to.split("-").map(Number);
  return `${df} ${months[mf-1]} — ${dt} ${months[mt-1]}`;
}

export default function TemplatesPanel({ open, employees = [], branches = [], onClose, onGenerated }) {
  const toast = useToast();
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [resultMsg, setResultMsg] = useState(null); // { tone, text }

  const [genFrom, setGenFrom] = useState(todayYmd());
  const [genTo, setGenTo]     = useState(plusDaysYmd(28));
  const [replace, setReplace] = useState(false);

  const [form, setForm] = useState({
    employee_id: "", branch_id: "",
    weekdays: [0, 1, 2, 3, 4],
    start_time: "10:00", end_time: "19:00",
  });

  useEffect(() => {
    if (open) { load(); setResultMsg(null); setShowAddForm(false); }
  }, [open]);

  // Auto-show form if no templates yet
  useEffect(() => {
    if (!loading && templates.length === 0) setShowAddForm(true);
  }, [loading, templates.length]);

  async function load() {
    setLoading(true);
    try {
      const d = await apiFetch("/api/v1/schedule/templates");
      setTemplates(Array.isArray(d) ? d : []);
    } catch (e) {
      toast.error("Не удалось загрузить шаблоны");
    } finally { setLoading(false); }
  }

  async function createBatch() {
    if (!form.employee_id)             return toast.warning("Выберите сотрудника");
    if (!form.branch_id)               return toast.warning("Выберите филиал");
    if (form.weekdays.length === 0)    return toast.warning("Выберите хотя бы один день");
    if (form.end_time <= form.start_time) return toast.warning("Конец должен быть позже начала");

    setCreating(true);
    const conflicts = [];
    let createdCount = 0;
    try {
      for (const wd of form.weekdays) {
        try {
          await apiFetch("/api/v1/schedule/templates", {
            method: "POST",
            body: JSON.stringify({
              employee_id: Number(form.employee_id),
              branch_id:   Number(form.branch_id),
              weekday:     wd, start_time: form.start_time, end_time: form.end_time,
            }),
          });
          createdCount += 1;
        } catch (e) {
          // 409 conflict — другой шаблон уже занимает это время для сотрудника
          const c = e?.payload?.conflict;
          if (e?.status === 409 && c) {
            conflicts.push({ wd, branch: c.branch_name, range: `${c.start_time}–${c.end_time}` });
          } else {
            throw e;
          }
        }
      }
      const emp = employees.find(e => Number(e.id) === Number(form.employee_id));
      if (createdCount > 0) {
        toast.success(`✓ Сохранено: ${emp?.name || "Сотрудник"} — ${createdCount} ${pluralShift(createdCount)} в шаблоне`);
        await load();
        setShowAddForm(false);
        setForm(f => ({ ...f, weekdays: [0,1,2,3,4] }));
      }
      if (conflicts.length > 0) {
        const list = conflicts
          .map(c => `${DAYS[c.wd].l}: уже стоит ${c.range} в "${c.branch || "—"}"`)
          .join("; ");
        toast.warning(`Пропущено (пересечение по времени): ${list}. Сотрудник не может быть в двух местах одновременно.`);
      }
    } catch (e) {
      toast.error("Ошибка создания");
    } finally { setCreating(false); }
  }

  async function removeGroup(group) {
    const n = group.items.length;
    if (!confirm(`Удалить ВСЕ шаблоны (${n}) для ${group.employee_name} в "${group.branch_name}"?\nУже созданные смены не пострадают.`)) return;
    try {
      await Promise.all(group.items.map(t =>
        apiFetch(`/api/v1/schedule/templates/${t.id}`, { method: "DELETE" })
      ));
      const ids = new Set(group.items.map(t => t.id));
      setTemplates(prev => prev.filter(t => !ids.has(t.id)));
      toast.success(`✓ Удалено шаблонов: ${n}`);
    } catch (e) {
      toast.error("Не удалось удалить");
      load();
    }
  }

  async function removeTemplate(id) {
    if (!confirm("Удалить этот шаблон? Уже созданные смены не пострадают.")) return;
    try {
      await apiFetch(`/api/v1/schedule/templates/${id}`, { method: "DELETE" });
      setTemplates(prev => prev.filter(t => t.id !== id));
    } catch (e) { toast.error("Не удалось удалить"); }
  }

  async function generate() {
    if (templates.length === 0) {
      setResultMsg({ tone: "warning", text: "Сначала создайте хотя бы один шаблон ↓" });
      return;
    }
    if (!genFrom || !genTo) return toast.warning("Укажите период");
    if (genFrom > genTo)    return toast.warning("Дата начала позже конца");

    setGenerating(true);
    setResultMsg(null);
    try {
      const r = await apiFetch("/api/v1/schedule/templates/generate", {
        method: "POST",
        body: JSON.stringify({ date_from: genFrom, date_to: genTo, replace }),
      });

      // Human-friendly result
      if (r.created > 0 && r.replaced > 0) {
        setResultMsg({ tone: "success",
          text: `Готово! Заменили старые смены и поставили ${r.created} новых на период ${fmtRangeDates(genFrom, genTo)}.` });
      } else if (r.created > 0) {
        setResultMsg({ tone: "success",
          text: `Готово! Добавили ${r.created} ${pluralShift(r.created)} в расписание на ${fmtRangeDates(genFrom, genTo)}.` });
      } else if (r.skipped > 0 && r.created === 0) {
        setResultMsg({ tone: "info",
          text: `Расписание на этот период уже стоит по шаблонам (${r.skipped} ${pluralShift(r.skipped)}). Менять нечего. Если хочешь перезаписать — поставь галочку «Заменить существующие» и нажми ещё раз.` });
      } else {
        setResultMsg({ tone: "warning",
          text: `Шаблоны не подошли к этому периоду. Проверь дни недели в шаблонах и даты периода.` });
      }
      onGenerated?.();
    } catch (e) {
      setResultMsg({ tone: "error", text: "Не удалось сгенерировать. Попробуй ещё раз." });
    } finally { setGenerating(false); }
  }

  const grouped = useMemo(() => {
    const m = new Map();
    for (const t of templates) {
      const k = `${t.employee_id}|${t.branch_id}`;
      if (!m.has(k)) m.set(k, { employee_id: t.employee_id, branch_id: t.branch_id,
        employee_name: t.employee_name, branch_name: t.branch_name, items: [] });
      m.get(k).items.push(t);
    }
    return Array.from(m.values()).map(g => ({ ...g, items: g.items.sort((a,b) => a.weekday - b.weekday) }));
  }, [templates]);

  if (!open) return null;

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 99 }} />
      <div style={{
        position: "fixed", top: 0, right: 0, width: 480, maxWidth: "94vw",
        height: "100vh", zIndex: 100, background: "var(--bg-panel)",
        borderLeft: "1px solid var(--border)",
        boxShadow: "-14px 0 32px rgba(0,0,0,0.3)",
        display: "flex", flexDirection: "column",
      }}>
        {/* Header */}
        <div style={{
          padding: "14px 18px", borderBottom: "1px solid var(--border)",
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 10,
              background: "linear-gradient(135deg, #3acfd5, #6558f5)",
              display: "flex", alignItems: "center", justifyContent: "center", color: "#fff",
            }}>
              <CalendarPlus size={16} />
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)", letterSpacing: "-0.01em" }}>
                Шаблоны расписания
              </div>
              <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                Регулярные смены сотрудников
              </div>
            </div>
          </div>
          <button onClick={onClose} style={iconBtn()}><X size={14}/></button>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "14px 18px", display: "grid", gap: 14 }}>

          {/* Explainer */}
          <div style={{
            display: "flex", gap: 10, padding: 12, borderRadius: 12,
            background: "rgba(58,207,213,0.08)", border: "1px solid rgba(58,207,213,0.25)",
          }}>
            <Lightbulb size={16} color="#3acfd5" style={{ flexShrink: 0, marginTop: 1 }} />
            <div style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.5 }}>
              <b style={{ color: "var(--text-primary)" }}>Что это?</b> Шаблон = постоянное правило. Например:&nbsp;
              <span style={{ color: "#3acfd5" }}>Иванова работает Пн-Пт 10-19 в Левом берегу</span>. Заведи шаблоны, выбери период — мы расставим смены автоматически. Не нужно каждый день создавать смену руками.
            </div>
          </div>

          {/* ──── СПИСОК ШАБЛОНОВ (главное) ──── */}
          <div>
            <div style={{ ...sectionTitle(), marginBottom: 10 }}>
              <CheckIcon size={12} />
              Ваши шаблоны
              <span style={{ color: "var(--text-faint)", fontWeight: 500 }}>· {grouped.length}</span>
            </div>
            {loading ? (
              <div style={{ padding: 24, textAlign: "center", color: "var(--text-muted)" }}>
                <Loader2 size={18} className="spin" />
              </div>
            ) : grouped.length === 0 ? (
              <div style={{
                padding: 24, textAlign: "center", color: "var(--text-muted)", fontSize: 12,
                background: "var(--bg-section)", borderRadius: 10, border: "1px dashed var(--border)",
              }}>
                Шаблонов пока нет. Создайте первый ↓
              </div>
            ) : (
              <div style={{ display: "grid", gap: 8 }}>
                {grouped.map((g, i) => (
                  <div key={i} style={{
                    background: "var(--bg-card)", border: "1px solid var(--border)",
                    borderRadius: 12, padding: 12,
                  }}>
                    <div style={{
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                      marginBottom: 8, gap: 8,
                    }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>
                        {g.employee_name}
                        <span style={{ color: "var(--text-muted)", fontWeight: 500 }}> · {g.branch_name}</span>
                        <span style={{ color: "var(--text-faint)", fontWeight: 500, marginLeft: 6 }}>· {g.items.length}</span>
                      </div>
                      <button onClick={() => removeGroup(g)} style={{
                        background: "transparent", border: "1px solid rgba(239,68,68,0.35)",
                        color: "#fca5a5", padding: "3px 8px", borderRadius: 7, cursor: "pointer",
                        fontSize: 11, fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 4,
                      }} title="Удалить все шаблоны этого сотрудника в этом филиале">
                        <Trash2 size={11}/> Удалить все
                      </button>
                    </div>
                    <div style={{ display: "grid", gap: 4 }}>
                      {g.items.map(t => (
                        <div key={t.id} style={{
                          display: "flex", justifyContent: "space-between", alignItems: "center",
                          padding: "6px 10px", borderRadius: 8, background: "var(--bg-section)",
                          fontSize: 12, color: "var(--text-secondary)",
                        }}>
                          <span>
                            <b style={{ color: "var(--text-primary)", marginRight: 6 }}>{DAYS[t.weekday]?.l}</b>
                            {String(t.start_time).slice(0,5)}–{String(t.end_time).slice(0,5)}
                          </span>
                          <button onClick={() => removeTemplate(t.id)} style={{
                            background: "transparent", border: "none", cursor: "pointer",
                            color: "#fca5a5", padding: 2, display: "flex",
                          }} title="Удалить">
                            <Trash2 size={12}/>
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {!showAddForm ? (
              <button onClick={() => setShowAddForm(true)} style={{
                marginTop: 10, width: "100%", padding: 10, borderRadius: 10,
                border: "1px dashed var(--border)", background: "transparent",
                color: "var(--text-secondary)", fontSize: 13, fontWeight: 600, cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
              }}>
                <Plus size={13}/> Добавить шаблон
              </button>
            ) : (
              <div style={{
                marginTop: 10, background: "var(--bg-card)", border: "1px solid var(--border)",
                borderRadius: 12, padding: 14,
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-primary)" }}>
                    Новый шаблон
                  </div>
                  <button onClick={() => setShowAddForm(false)} style={{
                    width: 22, height: 22, borderRadius: 6, border: "none",
                    background: "transparent", color: "var(--text-muted)", cursor: "pointer",
                  }}><X size={13}/></button>
                </div>

                <div style={{ display: "grid", gap: 8 }}>
                  <div>
                    <div style={labelStyle()}>Сотрудник</div>
                    <select value={form.employee_id} onChange={e => setForm({...form, employee_id: e.target.value})} style={inp()}>
                      <option value="">Выбрать…</option>
                      {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <div style={labelStyle()}>Филиал</div>
                    <select value={form.branch_id} onChange={e => setForm({...form, branch_id: e.target.value})} style={inp()}>
                      <option value="">Выбрать…</option>
                      {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <div style={labelStyle()}>Дни недели</div>
                    <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                      {DAYS.map(d => {
                        const on = form.weekdays.includes(d.v);
                        return (
                          <button key={d.v} type="button"
                            onClick={() => setForm({
                              ...form,
                              weekdays: on ? form.weekdays.filter(x => x !== d.v) : [...form.weekdays, d.v]
                            })}
                            style={{
                              padding: "5px 12px", borderRadius: 999,
                              border: `1.5px solid ${on ? "#3acfd5" : "var(--border)"}`,
                              background: on ? "rgba(58,207,213,0.14)" : "var(--bg-card)",
                              color: on ? "#3acfd5" : "var(--text-primary)",
                              fontSize: 12, fontWeight: 600, cursor: "pointer",
                            }}>
                            {d.l}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    <div>
                      <div style={labelStyle()}>Начало</div>
                      <input type="time" value={form.start_time} onChange={e => setForm({...form, start_time: e.target.value})} style={inp()} />
                    </div>
                    <div>
                      <div style={labelStyle()}>Конец</div>
                      <input type="time" value={form.end_time} onChange={e => setForm({...form, end_time: e.target.value})} style={inp()} />
                    </div>
                  </div>

                  {/* Preview sentence */}
                  {form.employee_id && form.branch_id && form.weekdays.length > 0 && (
                    <div style={{
                      padding: "8px 10px", borderRadius: 8, fontSize: 12,
                      background: "rgba(58,207,213,0.08)", color: "var(--text-secondary)",
                      borderLeft: "3px solid #3acfd5",
                    }}>
                      <b>{employees.find(e => Number(e.id) === Number(form.employee_id))?.name || "Сотрудник"}</b>
                      &nbsp;будет работать в&nbsp;
                      <b>{form.weekdays.sort().map(w => DAYS[w].l).join(", ")}</b>
                      &nbsp;с <b>{form.start_time}</b> до <b>{form.end_time}</b> в&nbsp;
                      <b>{branches.find(b => Number(b.id) === Number(form.branch_id))?.name || "филиале"}</b>
                    </div>
                  )}

                  <button onClick={createBatch} disabled={creating} style={{
                    padding: "10px", borderRadius: 10, border: "none",
                    cursor: creating ? "wait" : "pointer",
                    background: "linear-gradient(90deg, #3acfd5, #6558f5)",
                    color: "#fff", fontSize: 13, fontWeight: 700,
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                    opacity: creating ? 0.7 : 1,
                  }}>
                    {creating ? <Loader2 size={13} className="spin"/> : <Plus size={13}/>}
                    Сохранить шаблон
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* ──── РАССТАВИТЬ СМЕНЫ ──── */}
          <div style={{
            background: "var(--bg-section)", border: "1px solid var(--border)",
            borderRadius: 12, padding: 14,
          }}>
            <div style={sectionTitle()}>
              <Wand2 size={12} />
              Расставить смены в расписании
            </div>
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 10 }}>
              На какой период расставить смены по шаблонам выше
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <div>
                <div style={labelStyle()}>С</div>
                <input type="date" value={genFrom} onChange={e => setGenFrom(e.target.value)} style={inp()} />
              </div>
              <div>
                <div style={labelStyle()}>По</div>
                <input type="date" value={genTo} onChange={e => setGenTo(e.target.value)} style={inp()} />
              </div>
            </div>

            {/* Quick presets */}
            <div style={{ display: "flex", gap: 4, marginTop: 8, flexWrap: "wrap" }}>
              {[
                { l: "Неделя",       days: 7 },
                { l: "2 недели",     days: 14 },
                { l: "Месяц",        days: 30 },
                { l: "3 месяца",     days: 90 },
              ].map(p => (
                <button key={p.l} onClick={() => { setGenFrom(todayYmd()); setGenTo(plusDaysYmd(p.days)); }}
                  style={{
                    padding: "4px 10px", borderRadius: 999, border: "1px solid var(--border)",
                    background: "var(--bg-card)", color: "var(--text-secondary)",
                    fontSize: 11, fontWeight: 600, cursor: "pointer",
                  }}>
                  {p.l}
                </button>
              ))}
            </div>

            <label style={{
              display: "flex", alignItems: "flex-start", gap: 7, marginTop: 12,
              fontSize: 12, color: "var(--text-secondary)", cursor: "pointer", lineHeight: 1.4,
            }}>
              <input type="checkbox" checked={replace} onChange={e => setReplace(e.target.checked)}
                style={{ accentColor: "#ef4444", marginTop: 2 }} />
              <span>
                <b style={{ color: "var(--text-primary)" }}>Заменить существующие смены</b>
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 1 }}>
                  Удалит уже стоящие смены в этом периоде и поставит новые по шаблонам
                </div>
              </span>
            </label>

            <button onClick={generate} disabled={generating || templates.length === 0} style={{
              marginTop: 12, width: "100%", padding: "11px",
              borderRadius: 10, border: "none",
              cursor: generating || templates.length === 0 ? "not-allowed" : "pointer",
              background: templates.length === 0 ? "var(--bg-card)" : "linear-gradient(90deg, #3acfd5, #6558f5)",
              color: templates.length === 0 ? "var(--text-faint)" : "#fff",
              fontWeight: 700, fontSize: 13,
              display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
              opacity: generating ? 0.7 : 1,
            }}>
              {generating ? <Loader2 size={14} className="spin" /> : <Wand2 size={14}/>}
              Сгенерировать смены
            </button>

            {/* Inline result */}
            {resultMsg && (
              <div style={{
                marginTop: 12, padding: "10px 12px", borderRadius: 10,
                fontSize: 12, lineHeight: 1.5,
                background: TONES[resultMsg.tone].bg,
                border: `1px solid ${TONES[resultMsg.tone].border}`,
                color: TONES[resultMsg.tone].text,
                display: "flex", gap: 8, alignItems: "flex-start",
              }}>
                <span style={{ fontSize: 14, lineHeight: 1.2 }}>{TONES[resultMsg.tone].icon}</span>
                <span>{resultMsg.text}</span>
              </div>
            )}
          </div>
        </div>

        <style>{`@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}.spin{animation:spin 1s linear infinite}`}</style>
      </div>
    </>
  );
}

const TONES = {
  success: { bg: "rgba(34,197,94,0.10)",  border: "rgba(34,197,94,0.35)",  text: "#86efac", icon: "✅" },
  info:    { bg: "rgba(58,207,213,0.10)", border: "rgba(58,207,213,0.35)", text: "#7dd3fc", icon: "ℹ️" },
  warning: { bg: "rgba(245,158,11,0.10)", border: "rgba(245,158,11,0.35)", text: "#fcd34d", icon: "⚠️" },
  error:   { bg: "rgba(239,68,68,0.10)",  border: "rgba(239,68,68,0.35)",  text: "#fca5a5", icon: "❌" },
};

function pluralShift(n) {
  const m10 = n % 10, m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return "смену";
  if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return "смены";
  return "смен";
}

function iconBtn() {
  return { width: 28, height: 28, borderRadius: 8,
    border: "1px solid var(--border)", background: "var(--bg-card)",
    color: "var(--text-secondary)", cursor: "pointer",
    display: "flex", alignItems: "center", justifyContent: "center" };
}
function inp() {
  return { width: "100%", padding: "7px 10px", borderRadius: 9,
    border: "1px solid var(--border-input)", background: "var(--bg-input)",
    color: "var(--text-primary)", fontSize: 13, outline: "none", boxSizing: "border-box" };
}
function labelStyle() {
  return { fontSize: 10, fontWeight: 700, color: "var(--text-muted)",
    textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 3 };
}
function sectionTitle() {
  return { display: "flex", alignItems: "center", gap: 6,
    fontSize: 11, fontWeight: 700, color: "var(--text-secondary)",
    textTransform: "uppercase", letterSpacing: "0.06em" };
}
