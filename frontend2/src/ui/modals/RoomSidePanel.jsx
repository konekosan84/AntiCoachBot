import { useEffect, useMemo, useState } from "react";

export default function RoomSidePanel({ room, branches, onClose, onSaved }) {
  const sortedBranches = useMemo(() => {
    return (branches || [])
      .slice()
      .sort((a, b) =>
        (a.name || "").localeCompare(b.name || "", "ru", { sensitivity: "base" })
      );
  }, [branches]);

  const [form, setForm] = useState({
    name: "",
    branch_ids: [],
    capacity: "",
    description: "",
    is_active: true,
  });

  useEffect(() => {
    if (room) {
      setForm({
        name: room.name || "",
        branch_ids: Array.isArray(room.branch_ids)
          ? room.branch_ids
          : room.branch_id ? [room.branch_id] : [],
        capacity: room.capacity ?? "",
        description: room.description || "",
        is_active: room.is_active ?? true,
      });
    } else {
      setForm({ name: "", branch_ids: [], capacity: "", description: "", is_active: true });
    }
  }, [room]);

  const update = (key, value) => setForm(prev => ({ ...prev, [key]: value }));

  const toggleBranch = (branchId, checked) => {
    const set = new Set(form.branch_ids || []);
    if (checked) set.add(branchId);
    else set.delete(branchId);
    update("branch_ids", Array.from(set));
  };

  return (
    <>
      {/* Overlay */}
      <div
        onClick={onClose}
        style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 99 }}
      />

      {/* Panel — flex column, scrollable body, sticky header/footer */}
      <div
        style={{
          position: "fixed", top: 0, right: 0, width: 380, maxWidth: "94vw",
          height: "100vh", zIndex: 100,
          background: "var(--bg-panel)",
          borderLeft: "1px solid var(--border)",
          boxShadow: "-14px 0 32px rgba(0,0,0,0.3)",
          display: "flex", flexDirection: "column",
        }}
      >
        {/* Header (sticky) */}
        <div style={{
          padding: "12px 16px", borderBottom: "1px solid var(--border)",
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
        }}>
          <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: "-0.01em", color: "var(--text-primary)" }}>
            {room ? "Редактировать помещение" : "Новое помещение"}
          </div>
          <button
            onClick={onClose}
            title="Закрыть"
            style={{
              width: 28, height: 28, borderRadius: 8,
              border: "1px solid var(--border)",
              background: "var(--bg-card)",
              cursor: "pointer", color: "var(--text-secondary)",
              fontSize: 16,
            }}
          >
            ✕
          </button>
        </div>

        {/* Body (scrollable) */}
        <div style={{ flex: 1, overflowY: "auto", padding: "14px 16px" }}>
          <Field label="Название">
            <input
              placeholder="Например, Зал Лондон"
              value={form.name}
              onChange={e => update("name", e.target.value)}
              style={inputStyle}
            />
          </Field>

          <Field label="Филиалы (можно несколько)">
            <div style={{
              border: "1px solid var(--border-input)",
              background: "var(--bg-input)",
              borderRadius: 10, padding: 10,
              maxHeight: 200, overflowY: "auto",
            }}>
              {sortedBranches.length === 0 ? (
                <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Нет филиалов</div>
              ) : sortedBranches.map(b => {
                const checked = form.branch_ids?.includes(b.id);
                return (
                  <label key={b.id} style={{
                    display: "flex", gap: 10, alignItems: "center",
                    padding: "6px 0", color: "var(--text-primary)", fontSize: 13, cursor: "pointer",
                  }}>
                    <input
                      type="checkbox"
                      checked={!!checked}
                      onChange={e => toggleBranch(b.id, e.target.checked)}
                      style={{ accentColor: "#3acfd5" }}
                    />
                    <span>{b.name}</span>
                  </label>
                );
              })}
            </div>
          </Field>

          <Field label="Вместимость">
            <input
              type="number"
              placeholder="Сколько человек влезает"
              value={form.capacity}
              onChange={e => update("capacity", e.target.value === "" ? "" : Number(e.target.value))}
              style={inputStyle}
            />
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
              type="checkbox"
              checked={!!form.is_active}
              onChange={e => update("is_active", e.target.checked)}
              style={{ accentColor: "#3acfd5" }}
            />
            Активно
          </label>
        </div>

        {/* Footer (sticky) */}
        <div style={{
          padding: "12px 16px", borderTop: "1px solid var(--border)",
          display: "flex", gap: 10,
          background: "var(--bg-panel)",
        }}>
          <button
            onClick={() => onSaved({
              ...form,
              branch_ids: (form.branch_ids || []).map(Number).filter(Boolean),
              capacity: form.capacity === "" ? null : form.capacity,
            })}
            style={{
              flex: 1, padding: "9px 0", borderRadius: 10, border: "none", cursor: "pointer",
              background: "linear-gradient(90deg, #3acfd5, #6558f5)",
              color: "#fff", fontWeight: 700, fontSize: 13,
            }}
          >
            Сохранить
          </button>
          <button
            onClick={onClose}
            style={{
              padding: "9px 16px", borderRadius: 10, cursor: "pointer",
              border: "1px solid var(--border)",
              background: "var(--bg-card)",
              color: "var(--text-secondary)", fontSize: 13,
            }}
          >
            Отмена
          </button>
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
