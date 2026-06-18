import { useState } from "react";
import { PhotoUrl } from "../PhotoUpload.jsx";
import CardActions from "../CardActions.jsx";

const STATUS_CONFIG = {
  active:   { label: "Работает",  color: "#22c55e" },
  vacation: { label: "Отпуск",    color: "#eab308" },
  sick:     { label: "Болеет",    color: "#ef4444" },
  inactive: { label: "Неактивен", color: "#9ca3af" },
  fired:    { label: "Уволен",    color: "#6b7280" },
};

const ROLE_LABELS = {
  owner:    "Владелец",
  admin:    "Админ",
  employee: "Сотрудник",
  manager:  "Менеджер",
};

export default function NeoEmployeeCard({ employee, onClick, onEdit, onDelete }) {
  const [hover, setHover] = useState(false);
  if (!employee) return null;

  const name     = employee.full_name || employee.name || "Без имени";
  const position = employee.position || "";
  const role     = employee.role     || "employee";
  const status   = employee.status   || "active";
  const branches = employee.branches || [];
  const photo    = PhotoUrl(employee.photo_url);

  const initials = name.split(" ").filter(Boolean)
    .map(w => w[0]).slice(0, 2).join("").toUpperCase() || "?";

  const statusConfig = STATUS_CONFIG[status] || STATUS_CONFIG.inactive;
  const roleLabel    = ROLE_LABELS[role] || role;

  return (
    <div
      onClick={() => onClick?.(employee)}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        position: "relative",
        padding: 12,
        borderRadius: 14,
        background: "var(--bg-card-elevated)",
        border: "1px solid var(--border-card-elevated)",
        boxShadow: hover
          ? "0 10px 22px rgba(0,0,0,0.22), 0 0 0 1px rgba(58,207,213,0.28)"
          : "var(--shadow-card-elevated)",
        cursor: "pointer",
        transition: "transform 0.18s ease, box-shadow 0.18s ease",
        transform: hover ? "translateY(-2px)" : "translateY(0)",
        overflow: "hidden",
      }}
    >
      {/* Decorative gradient blob */}
      <div style={{
        position: "absolute", top: -40, right: -40,
        width: 140, height: 140, borderRadius: "50%",
        background: "radial-gradient(circle, rgba(58,207,213,0.22), transparent 70%)",
        opacity: hover ? 1 : 0.5,
        transition: "opacity 0.25s",
        pointerEvents: "none",
      }} />

      {/* Header: photo + name + actions */}
      <div style={{ display: "flex", gap: 10, alignItems: "center", position: "relative" }}>
        {/* Avatar */}
        <div style={{
          position: "relative", flexShrink: 0,
          width: 40, height: 40, borderRadius: 11,
          background: photo
            ? `url(${photo}) center/cover no-repeat`
            : "linear-gradient(135deg, #3acfd5, #6558f5)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontWeight: 700, fontSize: 13, color: "#fff",
        }}>
          {!photo && initials}
          {/* Status dot */}
          <div style={{
            position: "absolute", bottom: -2, right: -2,
            width: 11, height: 11, borderRadius: "50%",
            background: statusConfig.color,
            border: "2px solid var(--bg-card-elevated)",
          }} title={statusConfig.label} />
        </div>

        {/* Name + position */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 14, fontWeight: 700, color: "var(--text-primary)",
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            letterSpacing: "-0.01em",
          }}>{name}</div>
          {position && (
            <div style={{
              fontSize: 11, color: "var(--text-secondary)", marginTop: 1,
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}>{position}</div>
          )}
        </div>

        {/* Action buttons */}
        <div style={{ opacity: hover ? 1 : 0, transition: "opacity 0.15s" }}>
          <CardActions
            onEdit={() => onEdit?.(employee)}
            onDelete={() => onDelete?.(employee)}
          />
        </div>
      </div>

      {/* Tags row */}
      <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginTop: 10 }}>
        <Tag color="#3acfd5" bg="rgba(58,207,213,0.12)">{roleLabel}</Tag>
        {branches.slice(0, 3).map(b => (
          <span key={b.id} style={{
            fontSize: 10, padding: "2px 7px", borderRadius: 5,
            background: "var(--bg-section)",
            color: "var(--text-muted)",
            border: "1px solid var(--border)",
            fontWeight: 500,
          }}>{b.name}</span>
        ))}
        {branches.length > 3 && (
          <span style={{ fontSize: 10, color: "var(--text-muted)", padding: "2px 4px" }}>
            +{branches.length - 3}
          </span>
        )}
      </div>
    </div>
  );
}

function Tag({ children, color, bg }) {
  return (
    <span style={{
      fontSize: 10, fontWeight: 700,
      padding: "2px 8px", borderRadius: 999,
      background: bg, color,
      letterSpacing: "0.02em",
      textTransform: "uppercase",
    }}>
      {children}
    </span>
  );
}

