import { useState } from "react";
import { DoorOpen, Users as UsersIcon } from "lucide-react";
import { PhotoUrl } from "../PhotoUpload.jsx";
import CardActions from "../CardActions.jsx";

export default function NeoRoomCard({ room, branches, onClick, onEdit, onDelete }) {
  const [hover, setHover] = useState(false);
  const isActive  = !!room.is_active;
  const photo     = PhotoUrl(room.photo_url);
  const statusColor = isActive ? "#22c55e" : "#9ca3af";

  // Multiple branches support
  const branchIds = Array.isArray(room.branch_ids)
    ? room.branch_ids
    : (room.branch_id ? [room.branch_id] : []);
  const branchNames = branchIds
    .map(id => branches?.find(b => Number(b.id) === Number(id))?.name)
    .filter(Boolean);

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
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div style={{
        width: 40, height: 40, borderRadius: 11, flexShrink: 0,
        background: photo
          ? `url(${photo}) center/cover no-repeat`
          : "linear-gradient(135deg, #3acfd5, #6558f5)",
        display: "flex", alignItems: "center", justifyContent: "center",
        color: "#fff",
      }}>
        {!photo && <DoorOpen size={17} />}
      </div>

      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{
          fontSize: 14, fontWeight: 700, color: "var(--text-primary)",
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          letterSpacing: "-0.01em",
        }}>{room.name}</div>

        <div style={{
          fontSize: 11, color: "var(--text-secondary)",
          marginTop: 3, display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center",
        }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
            <UsersIcon size={11} /> {room.capacity ?? "—"}
          </span>
          {branchNames.slice(0, 2).map((n, i) => (
            <span key={i} style={{
              fontSize: 10, padding: "1px 6px", borderRadius: 5,
              background: "var(--bg-section)",
              color: "var(--text-muted)",
              border: "1px solid var(--border)",
            }}>{n}</span>
          ))}
          {branchNames.length > 2 && (
            <span style={{ fontSize: 10, color: "var(--text-muted)" }}>+{branchNames.length - 2}</span>
          )}
          {!isActive && (
            <span style={{
              fontSize: 10, fontWeight: 700, padding: "1px 7px", borderRadius: 999,
              background: `${statusColor}1f`, color: statusColor,
            }}>Неактивна</span>
          )}
        </div>
      </div>

      <div style={{ opacity: hover ? 1 : 0, transition: "opacity 0.15s" }}>
        <CardActions onEdit={onEdit} onDelete={onDelete} />
      </div>
    </div>
  );
}
