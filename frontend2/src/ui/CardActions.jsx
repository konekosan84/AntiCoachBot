import { Pencil, Trash2 } from "lucide-react";

/**
 * Unified Edit + Delete buttons for cards.
 * Usage:
 *   <CardActions onEdit={...} onDelete={...} />
 *   <CardActions onEdit={...} onDelete={...} variant="overlay" />  // for cards with photo cover
 *
 * Stop event propagation on the wrapper so card click handler doesn't fire.
 */
export default function CardActions({ onEdit, onDelete, variant = "default" }) {
  const isOverlay = variant === "overlay";

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      style={{ display: "flex", gap: 6 }}
    >
      <IconBtn onClick={onEdit}   title="Редактировать" isOverlay={isOverlay} kind="edit"   />
      <IconBtn onClick={onDelete} title="Удалить"       isOverlay={isOverlay} kind="delete" />
    </div>
  );
}

function IconBtn({ onClick, title, isOverlay, kind }) {
  const Icon = kind === "edit" ? Pencil : Trash2;
  const color = kind === "edit" ? "#3acfd5" : "#f87171";

  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onClick?.(); }}
      title={title}
      style={{
        width: 32, height: 32, borderRadius: 9,
        display: "flex", alignItems: "center", justifyContent: "center",
        cursor: "pointer",
        border: isOverlay
          ? "1px solid rgba(255,255,255,0.20)"
          : "1px solid var(--border)",
        background: isOverlay
          ? "rgba(0,0,0,0.40)"
          : "var(--bg-card)",
        backdropFilter: isOverlay ? "blur(8px)" : undefined,
        transition: "transform 0.12s, background 0.12s",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = "scale(1.05)";
        if (!isOverlay) e.currentTarget.style.background = "var(--bg-card-hover)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "scale(1)";
        if (!isOverlay) e.currentTarget.style.background = "var(--bg-card)";
      }}
    >
      <Icon size={14} color={color} strokeWidth={2.2} />
    </button>
  );
}
