export default function NeoSegmented({ value, onChange, options }) {
  return (
    <div
      style={{
        display: "inline-flex",
        padding: 4,
        borderRadius: 14,
        background: "var(--bg-section)",
        border: "1px solid var(--border)",
        backdropFilter: "blur(8px)",
      }}
    >
      {options.map(opt => {
        const active = value === opt.value;

        return (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            style={{
              padding: "7px 16px",
              borderRadius: 10,
              border: "none",
              cursor: "pointer",
              fontSize: 13,
              fontWeight: 600,
              color: active ? "#fff" : "var(--text-secondary)",
              background: active
                ? "linear-gradient(135deg, #3ACFD5, #6558F5)"
                : "transparent",
              boxShadow: active
                ? "0 0 0 1px rgba(58,207,213,.3), 0 4px 14px rgba(101,88,245,.3)"
                : "none",
              transition: "all .18s ease",
            }}
            onMouseEnter={e => {
              if (!active) {
                e.currentTarget.style.background = "var(--bg-card-hover)";
                e.currentTarget.style.color = "var(--text-primary)";
              }
            }}
            onMouseLeave={e => {
              if (!active) {
                e.currentTarget.style.background = "transparent";
                e.currentTarget.style.color = "var(--text-secondary)";
              }
            }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
