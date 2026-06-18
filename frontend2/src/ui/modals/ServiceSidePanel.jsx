import { useEffect, useMemo, useState } from "react";
import { getBranches } from "../../api/branches.js";

export default function ServiceSidePanel({ service, onClose, onSaved }) {
  const [form, setForm] = useState({
    name: "",
    price: "",
    duration: "",
    description: "",
    is_active: true,
    branch_ids: [],          // [] = доступна во всех филиалах
    all_branches: true,      // toggle for UX
  });
  const [branches, setBranches] = useState([]);

  useEffect(() => {
    getBranches().then(d => setBranches(Array.isArray(d) ? d : [])).catch(() => setBranches([]));
  }, []);

  useEffect(() => {
    if (service) {
      const bIds = Array.isArray(service.branch_ids) ? service.branch_ids.map(Number) : [];
      setForm({
        name: service.name || "",
        price: service.price ?? "",
        duration: service.duration ?? "",
        description: service.description || "",
        is_active: service.is_active ?? true,
        branch_ids: bIds,
        all_branches: bIds.length === 0,
      });
    } else {
      setForm({ name: "", price: "", duration: "", description: "", is_active: true, branch_ids: [], all_branches: true });
    }
  }, [service]);

  const update = (key, value) => setForm(prev => ({ ...prev, [key]: value }));

  const toggleBranch = (id) => {
    const has = form.branch_ids.includes(id);
    const next = has ? form.branch_ids.filter(x => x !== id) : [...form.branch_ids, id];
    update("branch_ids", next);
  };

  function handleSave() {
    onSaved({
      name:        form.name,
      price:       form.price,
      duration:    form.duration,
      description: form.description,
      is_active:   form.is_active,
      // If user selected "Во всех филиалах" — send empty array
      branch_ids:  form.all_branches ? [] : form.branch_ids,
    });
  }

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 99 }} />

      <div style={{
        position: "fixed", top: 0, right: 0, width: 380, maxWidth: "94vw",
        height: "100vh", zIndex: 100,
        background: "var(--bg-panel)",
        borderLeft: "1px solid var(--border)",
        boxShadow: "-14px 0 32px rgba(0,0,0,0.3)",
        display: "flex", flexDirection: "column",
      }}>
        <div style={{
          padding: "12px 16px", borderBottom: "1px solid var(--border)",
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: "-0.01em", color: "var(--text-primary)" }}>
            {service ? "Редактировать услугу" : "Новая услуга"}
          </div>
          <button onClick={onClose} style={{
            width: 28, height: 28, borderRadius: 8,
            border: "1px solid var(--border)", background: "var(--bg-card)",
            cursor: "pointer", color: "var(--text-secondary)", fontSize: 16,
          }}>✕</button>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "14px 16px" }}>
          <Field label="Название">
            <input
              placeholder="Например, Стрижка"
              value={form.name}
              onChange={e => update("name", e.target.value)}
              style={inputStyle}
            />
          </Field>

          <Field label="Цена">
            <input type="number" placeholder="0" value={form.price}
              onChange={e => update("price", e.target.value)} style={inputStyle} />
          </Field>

          <Field label="Длительность (мин)">
            <input type="number" placeholder="60" value={form.duration}
              onChange={e => update("duration", e.target.value)} style={inputStyle} />
          </Field>

          {/* === Branches === */}
          <Field label="В каких филиалах доступна">
            <div style={{ display: "grid", gap: 6 }}>
              <label style={modeRowStyle(form.all_branches)}>
                <input
                  type="radio" name="bmode" checked={form.all_branches}
                  onChange={() => update("all_branches", true)}
                  style={{ accentColor: "#3acfd5" }}
                />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>Во всех филиалах</div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                    Услуга доступна везде где есть мастера
                  </div>
                </div>
              </label>

              <label style={modeRowStyle(!form.all_branches)}>
                <input
                  type="radio" name="bmode" checked={!form.all_branches}
                  onChange={() => update("all_branches", false)}
                  style={{ accentColor: "#3acfd5" }}
                />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>Только в выбранных</div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                    Например: окрашивание только в Центре
                  </div>
                </div>
              </label>

              {!form.all_branches && (
                <div style={{
                  marginTop: 4, padding: 10, borderRadius: 10,
                  background: "var(--bg-section)", border: "1px solid var(--border)",
                  display: "flex", flexWrap: "wrap", gap: 6,
                }}>
                  {branches.length === 0 ? (
                    <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Сначала создайте филиалы</div>
                  ) : branches.map(b => {
                    const sel = form.branch_ids.includes(b.id);
                    return (
                      <button
                        key={b.id} type="button"
                        onClick={() => toggleBranch(b.id)}
                        style={{
                          padding: "5px 10px", borderRadius: 999,
                          border: `1.5px solid ${sel ? "#3acfd5" : "var(--border)"}`,
                          background: sel ? "rgba(58,207,213,0.12)" : "var(--bg-card)",
                          color: sel ? "#3acfd5" : "var(--text-primary)",
                          cursor: "pointer", fontSize: 12, fontWeight: 600,
                        }}
                      >
                        {sel && "✓ "}{b.name}
                      </button>
                    );
                  })}
                </div>
              )}

              {!form.all_branches && form.branch_ids.length === 0 && (
                <div style={{ fontSize: 11, color: "#fca5a5", marginTop: 4 }}>
                  Выберите хотя бы один филиал, иначе клиенты не увидят услугу
                </div>
              )}
            </div>
          </Field>

          <Field label="Описание">
            <textarea
              placeholder="Опционально"
              value={form.description}
              onChange={e => update("description", e.target.value)}
              style={{ ...inputStyle, minHeight: 64, resize: "vertical" }}
            />
          </Field>

          <label style={{
            display: "flex", alignItems: "center", gap: 8,
            color: "var(--text-primary)", fontSize: 13, cursor: "pointer",
          }}>
            <input
              type="checkbox" checked={!!form.is_active}
              onChange={e => update("is_active", e.target.checked)}
              style={{ accentColor: "#3acfd5" }}
            />
            Активна
          </label>
        </div>

        <div style={{
          padding: "12px 16px", borderTop: "1px solid var(--border)",
          display: "flex", gap: 10, background: "var(--bg-panel)",
        }}>
          <button onClick={handleSave} style={{
            flex: 1, padding: "9px 0", borderRadius: 10, border: "none", cursor: "pointer",
            background: "linear-gradient(90deg, #3acfd5, #6558f5)",
            color: "#fff", fontWeight: 700, fontSize: 13,
          }}>Сохранить</button>
          <button onClick={onClose} style={{
            padding: "9px 16px", borderRadius: 10, cursor: "pointer",
            border: "1px solid var(--border)", background: "var(--bg-card)",
            color: "var(--text-secondary)", fontSize: 13,
          }}>Отмена</button>
        </div>
      </div>
    </>
  );
}

function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 4 }}>{label}</div>
      {children}
    </div>
  );
}

function modeRowStyle(active) {
  return {
    display: "flex", alignItems: "center", gap: 10,
    padding: "9px 11px", borderRadius: 10, cursor: "pointer",
    border: `1.5px solid ${active ? "#3acfd5" : "var(--border)"}`,
    background: active ? "rgba(58,207,213,0.08)" : "var(--bg-card)",
  };
}

const inputStyle = {
  width: "100%",
  padding: "7px 10px",
  borderRadius: 10,
  border: "1px solid var(--border-input)",
  background: "var(--bg-input)",
  color: "var(--text-primary)",
  fontSize: 13,
  outline: "none",
  boxSizing: "border-box",
};
