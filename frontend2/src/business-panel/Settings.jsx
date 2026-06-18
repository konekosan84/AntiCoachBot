import { useState } from "react";
import { useSettings } from "../helpers/SettingsContext";
import { useAuth } from "../helpers/AuthContext";

const BOOKING_TYPES = [
  {
    value: "service",
    title: "Услуги",
    subtitle: "Салон, барбершоп, ногтевая студия",
    desc: "Клиент бронирует время на конкретную услугу. Опционально выбирает мастера.",
    icon: "💅",
    needs: "Услуги · Сотрудники · Филиалы",
  },
  {
    value: "room",
    title: "Помещения",
    subtitle: "Фотостудия, шиномонтаж, коворкинг",
    desc: "Клиент бронирует помещение на конкретное время. Без выбора мастера/услуги.",
    icon: "🏠",
    needs: "Помещения · Филиалы",
  },
];

export default function Settings() {
  const { user } = useAuth();
  const { bookingType, update } = useSettings();
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState("");
  const [err, setErr] = useState("");

  const isOwner = user?.role === "owner";

  async function selectType(value) {
    if (!isOwner) return;
    if (value === bookingType) return;
    setErr(""); setSavedMsg(""); setSaving(true);
    try {
      await update({ booking_type: value });
      setSavedMsg("Сохранено");
      setTimeout(() => setSavedMsg(""), 2000);
    } catch (e) {
      setErr(e?.message || "Не удалось сохранить");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ padding: "18px 20px", maxWidth: 900, margin: "0 auto", display: "grid", gap: 18 }}>
      <div>
        <div style={{ fontSize: 21, fontWeight: 800, color: "var(--text-primary)" }}>Настройки</div>
        <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4 }}>
          Базовая модель работы платформы
        </div>
      </div>

      {!isOwner && (
        <div style={{
          padding: "12px 14px", borderRadius: 12,
          background: "rgba(245,158,11,0.10)", border: "1px solid rgba(245,158,11,0.35)",
          color: "#fcd34d", fontSize: 13,
        }}>
          Только владелец платформы может менять настройки. Текущая роль: <b>{user?.role}</b>.
        </div>
      )}

      <div style={{
        background: "var(--bg-card)", border: "1px solid var(--border)",
        borderRadius: 16, padding: 18,
      }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)", marginBottom: 4 }}>
          Тип бронирования
        </div>
        <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 16 }}>
          Это меняет логику страницы «Записи» и «Расписание» — что обязательно выбирать клиенту.
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 12 }}>
          {BOOKING_TYPES.map((bt) => {
            const active = bt.value === bookingType;
            return (
              <button
                key={bt.value}
                onClick={() => selectType(bt.value)}
                disabled={!isOwner || saving}
                style={{
                  textAlign: "left",
                  padding: 16, borderRadius: 14,
                  border: `2px solid ${active ? "#3acfd5" : "var(--border)"}`,
                  background: active ? "rgba(58,207,213,0.08)" : "var(--bg-section)",
                  cursor: isOwner && !saving ? "pointer" : "not-allowed",
                  opacity: isOwner ? 1 : 0.7,
                  display: "grid", gap: 6,
                  transition: "all 0.15s",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 22 }}>{bt.icon}</span>
                  <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)" }}>{bt.title}</div>
                  {active && (
                    <span style={{
                      marginLeft: "auto", fontSize: 11, fontWeight: 700,
                      padding: "2px 8px", borderRadius: 6,
                      background: "#3acfd5", color: "#000",
                    }}>
                      ВЫБРАНО
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>{bt.subtitle}</div>
                <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>{bt.desc}</div>
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4, opacity: 0.85 }}>
                  Использует: {bt.needs}
                </div>
              </button>
            );
          })}
        </div>

        {savedMsg && (
          <div style={{ marginTop: 12, fontSize: 12, color: "#22c55e" }}>✓ {savedMsg}</div>
        )}
        {err && (
          <div style={{ marginTop: 12, fontSize: 12, color: "#fca5a5" }}>{err}</div>
        )}
      </div>
    </div>
  );
}
