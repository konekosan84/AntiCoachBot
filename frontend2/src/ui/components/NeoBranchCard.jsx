import { MapPin, Phone } from "lucide-react";
import { useState } from "react";
import { PhotoUrl } from "../PhotoUpload.jsx";
import CardActions from "../CardActions.jsx";

const STATUS_LABELS = {
  active:   { label: "Открыт",  color: "#22c55e" },
  inactive: { label: "Закрыт",  color: "#9ca3af" },
};

export default function NeoBranchCard({ branch, onClick, onEdit, onDelete }) {
  const [hover, setHover] = useState(false);
  if (!branch) return null;

  const name    = branch.name    || "Без названия";
  const address = branch.address || "";
  const phone   = branch.phone   || "";
  const status  = branch.status  || "active";
  const photo   = PhotoUrl(branch.photo_url);

  const statusConfig = STATUS_LABELS[status] || STATUS_LABELS.inactive;

  return (
    <div
      onClick={() => onClick?.(branch)}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        position: "relative",
        borderRadius: 14,
        overflow: "hidden",
        background: "var(--bg-card-elevated)",
        border: "1px solid var(--border-card-elevated)",
        boxShadow: hover
          ? "0 10px 22px rgba(0,0,0,0.22), 0 0 0 1px rgba(58,207,213,0.28)"
          : "var(--shadow-card-elevated)",
        cursor: "pointer",
        transition: "transform 0.18s ease, box-shadow 0.18s ease",
        transform: hover ? "translateY(-2px)" : "translateY(0)",
      }}
    >
      {/* Cover photo */}
      <div style={{
        position: "relative",
        height: 78,
        background: photo
          ? `url(${photo}) center/cover no-repeat`
          : "linear-gradient(135deg, #3acfd5 0%, #6558f5 100%)",
      }}>
        {/* Gradient overlay for readability */}
        <div style={{
          position: "absolute", inset: 0,
          background: photo ? "linear-gradient(180deg, transparent 0%, rgba(0,0,0,0.55) 100%)" : "transparent",
        }} />

        {/* Status badge top-right */}
        <span style={{
          position: "absolute", top: 8, right: 8,
          fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 999,
          background: `${statusConfig.color}33`,
          color: "#fff",
          backdropFilter: "blur(8px)",
          border: `1px solid ${statusConfig.color}66`,
        }}>
          ● {statusConfig.label}
        </span>

        {/* Actions */}
        <div style={{
          position: "absolute", top: 8, left: 8,
          opacity: hover ? 1 : 0,
          transition: "opacity 0.15s",
        }}>
          <CardActions
            variant="overlay"
            onEdit={() => onEdit?.(branch)}
            onDelete={() => onDelete?.(branch)}
          />
        </div>

        {/* Name overlay */}
        <div style={{
          position: "absolute", bottom: 8, left: 12, right: 12,
          fontSize: 14, fontWeight: 700, color: "#fff",
          textShadow: "0 1px 3px rgba(0,0,0,0.6)",
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          letterSpacing: "-0.01em",
        }}>
          {name}
        </div>
      </div>

      {/* Body */}
      <div style={{ padding: "10px 12px", display: "grid", gap: 4 }}>
        {address && (
          <div style={{
            display: "flex", alignItems: "center", gap: 6,
            fontSize: 12, color: "var(--text-secondary)",
          }}>
            <MapPin size={12} color="var(--text-muted)" />
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {address}
            </span>
          </div>
        )}
        {phone && (
          <div style={{
            display: "flex", alignItems: "center", gap: 6,
            fontSize: 12, color: "var(--text-secondary)",
          }}>
            <Phone size={12} color="var(--text-muted)" />
            <span>{phone}</span>
          </div>
        )}
      </div>
    </div>
  );
}

