import { useState } from "react";
import { Sparkles, Clock, Wallet, MapPin } from "lucide-react";
import CardActions from "../CardActions.jsx";

export default function NeoServiceCard({ service, branches = [], onClick, onEdit, onDelete }) {
  const [hover, setHover] = useState(false);
  const isActive    = !!service.is_active;
  const statusColor = isActive ? "#22c55e" : "#9ca3af";

  const bIds = Array.isArray(service.branch_ids) ? service.branch_ids.map(Number) : [];
  const isAllBranches = bIds.length === 0;
  const branchNames = isAllBranches
    ? []
    : bIds.map(id => branches.find(b => Number(b.id) === id)?.name).filter(Boolean);

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        padding: 12,
        borderRadius: 14,
        background: "var(--bg-card-elevated)",
        border: "1px solid var(--border-card-elevated)",
        boxShadow: hover
          ? "0 10px 22px rgba(0,0,0,0.22), 0 0 0 1px rgba(58,207,213,0.28)"
          : "var(--shadow-card-elevated)",
        cursor: "pointer",
        display: "flex",
        gap: 10,
        alignItems: "center",
        transition: "transform 0.18s ease, box-shadow 0.18s ease",
        transform: hover ? "translateY(-2px)" : "translateY(0)",
      }}
    >
      <div style={{
        width: 40, height: 40, borderRadius: 11, flexShrink: 0,
        background: "linear-gradient(135deg, #6558f5, #ec4899)",
        display: "flex", alignItems: "center", justifyContent: "center", color: "#fff",
      }}>
        <Sparkles size={17} />
      </div>

      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{
          fontSize: 14, fontWeight: 700, color: "var(--text-primary)",
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          letterSpacing: "-0.01em",
        }}>{service.name}</div>

        <div style={{
          marginTop: 3, display: "flex", flexWrap: "wrap", gap: 10,
          fontSize: 11, color: "var(--text-secondary)",
        }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
            <Wallet size={11} /> {service.price ?? "—"} ₽
          </span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
            <Clock size={11} /> {service.duration ? `${service.duration} мин` : "—"}
          </span>
          {!isActive && (
            <span style={{
              fontSize: 10, fontWeight: 700, padding: "1px 7px", borderRadius: 999,
              background: `${statusColor}1f`, color: statusColor,
            }}>
              Неактивна
            </span>
          )}
        </div>

        {/* Branches line */}
        <div style={{
          marginTop: 4, fontSize: 10, color: "var(--text-muted)",
          display: "flex", alignItems: "center", gap: 4,
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>
          <MapPin size={10} />
          {isAllBranches ? (
            <span>Все филиалы</span>
          ) : branchNames.length === 0 ? (
            <span style={{ color: "#fca5a5" }}>Не привязана ни к одному филиалу</span>
          ) : (
            <span>{branchNames.slice(0, 2).join(", ")}{branchNames.length > 2 ? ` +${branchNames.length - 2}` : ""}</span>
          )}
        </div>
      </div>

      <div style={{ opacity: hover ? 1 : 0, transition: "opacity 0.15s" }}>
        <CardActions onEdit={onEdit} onDelete={onDelete} />
      </div>
    </div>
  );
}
