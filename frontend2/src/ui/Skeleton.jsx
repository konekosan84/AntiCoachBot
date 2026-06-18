/**
 * Lightweight skeleton placeholders.
 * Usage:
 *   <Skeleton w="100%" h={20} />
 *   <SkeletonCircle size={40} />
 *   <SkeletonCardGrid count={6} />
 *   <SkeletonKpi count={7} />
 */

const SHIMMER_KEYFRAMES = `
@keyframes slotiq-shimmer {
  0%   { background-position: -200% 0; }
  100% { background-position:  200% 0; }
}`;

let injected = false;
function ensureKeyframes() {
  if (injected || typeof document === "undefined") return;
  const style = document.createElement("style");
  style.textContent = SHIMMER_KEYFRAMES;
  document.head.appendChild(style);
  injected = true;
}

const baseStyle = {
  display: "block",
  background:
    "linear-gradient(90deg, var(--bg-section) 0%, var(--bg-card-hover) 50%, var(--bg-section) 100%)",
  backgroundSize: "200% 100%",
  animation: "slotiq-shimmer 1.4s ease-in-out infinite",
  borderRadius: 8,
};

export default function Skeleton({ w = "100%", h = 14, radius = 8, style = {} }) {
  ensureKeyframes();
  return <span style={{ ...baseStyle, width: w, height: h, borderRadius: radius, ...style }} />;
}

export function SkeletonCircle({ size = 40 }) {
  ensureKeyframes();
  return <span style={{ ...baseStyle, width: size, height: size, borderRadius: "50%", display: "inline-block" }} />;
}

export function SkeletonCard({ height = 84 }) {
  ensureKeyframes();
  return (
    <div style={{
      padding: 12, borderRadius: 14,
      background: "var(--bg-card-elevated)",
      border: "1px solid var(--border-card-elevated)",
      display: "flex", gap: 10, alignItems: "center",
      height,
    }}>
      <SkeletonCircle size={40} />
      <div style={{ flex: 1, display: "grid", gap: 6 }}>
        <Skeleton w="55%" h={14} />
        <Skeleton w="35%" h={11} />
        <div style={{ display: "flex", gap: 6, marginTop: 2 }}>
          <Skeleton w={48} h={18} radius={999} />
          <Skeleton w={64} h={18} radius={999} />
        </div>
      </div>
    </div>
  );
}

export function SkeletonCardGrid({ count = 6, minW = 260, gap = 16 }) {
  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: `repeat(auto-fill, minmax(${minW}px, 1fr))`,
      gap,
    }}>
      {Array.from({ length: count }).map((_, i) => <SkeletonCard key={i} />)}
    </div>
  );
}

export function SkeletonKpi({ count = 7 }) {
  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
      gap: 12,
    }}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} style={{
          background: "var(--bg-card)", border: "1px solid var(--border)",
          borderRadius: 16, padding: "14px 16px",
          display: "flex", flexDirection: "column", gap: 8,
        }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <Skeleton w={28} h={28} radius={8} />
            <Skeleton w="60%" h={11} />
          </div>
          <Skeleton w="40%" h={26} />
        </div>
      ))}
    </div>
  );
}

export function SkeletonRow({ height = 36 }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 10,
      padding: "8px 12px", borderRadius: 10,
      background: "var(--bg-card)",
      border: "1px solid var(--border)",
      height,
    }}>
      <SkeletonCircle size={24} />
      <Skeleton w="35%" />
      <Skeleton w="20%" />
      <div style={{ flex: 1 }} />
      <Skeleton w={60} h={20} radius={999} />
    </div>
  );
}
