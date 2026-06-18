/**
 * Tiny inline SVG sparkline.
 * <Sparkline data={[1,4,3,6,8,5]} color="#3acfd5" width={80} height={26} />
 */
export default function Sparkline({
  data = [],
  width = 80,
  height = 26,
  color = "currentColor",
  strokeWidth = 1.6,
  fillOpacity = 0.10,
}) {
  if (!Array.isArray(data) || data.length < 2) {
    return <div style={{ width, height }} />;
  }

  const values = data.map(d => (typeof d === "number" ? d : Number(d?.value) || 0));
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = Math.max(1, max - min);
  const stepX = width / (values.length - 1);

  const points = values.map((v, i) => {
    const x = i * stepX;
    const y = height - 2 - ((v - min) / span) * (height - 4);
    return [x, y];
  });

  const line = points.map(([x, y], i) => (i === 0 ? `M ${x} ${y}` : `L ${x} ${y}`)).join(" ");
  const area = `${line} L ${width} ${height} L 0 ${height} Z`;

  return (
    <svg width={width} height={height} style={{ display: "block" }}>
      <path d={area} fill={color} fillOpacity={fillOpacity} />
      <path d={line} fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={points[points.length-1][0]} cy={points[points.length-1][1]} r={2.5} fill={color} />
    </svg>
  );
}
