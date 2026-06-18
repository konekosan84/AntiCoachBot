/**
 * Responsive area chart in pure SVG — no dependencies.
 * <AreaChart data={[{day:"2026-05-01", value: 4}, ...]} height={220} accent="#3acfd5" />
 */
export default function AreaChart({
  data = [],
  height = 220,
  accent = "#3acfd5",
  title,
}) {
  if (!Array.isArray(data) || data.length === 0) {
    return (
      <div style={{
        height, borderRadius: 14, border: "1px dashed var(--border)",
        display: "flex", alignItems: "center", justifyContent: "center",
        color: "var(--text-muted)", fontSize: 13,
      }}>
        Нет данных
      </div>
    );
  }

  const W = 1000; // viewBox width
  const H = height;
  const padX = 32, padY = 22;
  const innerW = W - padX * 2;
  const innerH = H - padY * 2;

  const values = data.map(d => Number(d.value) || 0);
  const max = Math.max(1, ...values);
  const step = innerW / Math.max(1, data.length - 1);

  const points = values.map((v, i) => {
    const x = padX + i * step;
    const y = padY + innerH - (v / max) * innerH;
    return [x, y];
  });

  const line = points.map(([x, y], i) => (i === 0 ? `M${x} ${y}` : `L${x} ${y}`)).join(" ");
  const area = `${line} L${padX + innerW} ${padY + innerH} L${padX} ${padY + innerH} Z`;

  // Y-axis labels
  const gridTicks = 4;
  const yTicks = Array.from({ length: gridTicks + 1 }, (_, i) => Math.round((max * i) / gridTicks));

  // X-axis labels (show ~5 evenly distributed)
  const labelCount = Math.min(6, data.length);
  const labelStep = Math.max(1, Math.floor(data.length / (labelCount - 1 || 1)));
  const xLabels = data.map((d, i) =>
    (i % labelStep === 0 || i === data.length - 1) ? { x: padX + i * step, label: shortDate(d.day) } : null
  ).filter(Boolean);

  return (
    <div style={{
      background: "var(--bg-card)", border: "1px solid var(--border)",
      borderRadius: 16, padding: 18,
    }}>
      {title && (
        <div style={{
          fontSize: 13, color: "var(--text-secondary)", fontWeight: 700,
          marginBottom: 6, letterSpacing: "0.04em", textTransform: "uppercase",
        }}>
          {title}
        </div>
      )}
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ width: "100%", height, display: "block" }}>
        <defs>
          <linearGradient id="slotiq-area-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"  stopColor={accent} stopOpacity="0.35" />
            <stop offset="100%" stopColor={accent} stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Grid lines */}
        {yTicks.map((t, i) => {
          const y = padY + innerH - (i / gridTicks) * innerH;
          return (
            <g key={i}>
              <line x1={padX} y1={y} x2={padX + innerW} y2={y}
                stroke="currentColor" strokeOpacity="0.10" strokeDasharray="2 4" />
              <text x={padX - 6} y={y + 4} fontSize="11" fill="currentColor" opacity="0.55" textAnchor="end">
                {t}
              </text>
            </g>
          );
        })}

        {/* Area + line */}
        <path d={area} fill="url(#slotiq-area-grad)" />
        <path d={line} fill="none" stroke={accent} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />

        {/* Points */}
        {points.map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r={2.5} fill={accent} />
        ))}

        {/* X labels */}
        {xLabels.map((l, i) => (
          <text key={i} x={l.x} y={H - 4} fontSize="11"
                fill="currentColor" opacity="0.55" textAnchor="middle">
            {l.label}
          </text>
        ))}
      </svg>
    </div>
  );
}

function shortDate(ymd) {
  const s = String(ymd || "").slice(0, 10);
  const [, m, d] = s.split("-");
  if (!m || !d) return s;
  const months = ["янв","фев","мар","апр","мая","июн","июл","авг","сен","окт","ноя","дек"];
  return `${Number(d)} ${months[Number(m)-1]}`;
}
