/**
 * Friendly empty state for lists with no data.
 * <EmptyState
 *   icon={Users}
 *   title="Пока нет сотрудников"
 *   subtitle="Добавьте первого, чтобы начать составлять расписание"
 *   action={{ label: "Добавить сотрудника", onClick: () => ... }}
 * />
 */
export default function EmptyState({ icon: Icon, title, subtitle, action, secondary }) {
  return (
    <div style={{
      padding: "48px 24px",
      borderRadius: 18,
      background: "var(--bg-card)",
      border: "1px dashed var(--border)",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: 14,
      textAlign: "center",
    }}>
      <div style={{
        width: 72, height: 72, borderRadius: 20,
        background: "linear-gradient(135deg, rgba(58,207,213,0.18), rgba(101,88,245,0.18))",
        border: "1px solid rgba(58,207,213,0.30)",
        display: "flex", alignItems: "center", justifyContent: "center",
        color: "#3acfd5",
      }}>
        {Icon ? <Icon size={32} strokeWidth={1.6} /> : <span style={{ fontSize: 32 }}>✨</span>}
      </div>

      <div>
        <div style={{ fontSize: 17, fontWeight: 700, color: "var(--text-primary)", letterSpacing: "-0.01em" }}>
          {title}
        </div>
        {subtitle && (
          <div style={{
            fontSize: 13, color: "var(--text-muted)", marginTop: 4,
            maxWidth: 380, lineHeight: 1.5,
          }}>
            {subtitle}
          </div>
        )}
      </div>

      {(action || secondary) && (
        <div style={{ display: "flex", gap: 10, marginTop: 6 }}>
          {action && (
            <button
              onClick={action.onClick}
              style={{
                padding: "10px 18px", borderRadius: 11, border: "none", cursor: "pointer",
                background: "linear-gradient(90deg, #3acfd5, #6558f5)",
                color: "#fff", fontWeight: 700, fontSize: 13,
                boxShadow: "0 6px 16px rgba(101,88,245,0.30)",
              }}
            >
              {action.label}
            </button>
          )}
          {secondary && (
            <button
              onClick={secondary.onClick}
              style={{
                padding: "10px 18px", borderRadius: 11, cursor: "pointer",
                border: "1px solid var(--border)",
                background: "var(--bg-card)",
                color: "var(--text-secondary)", fontSize: 13, fontWeight: 600,
              }}
            >
              {secondary.label}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
