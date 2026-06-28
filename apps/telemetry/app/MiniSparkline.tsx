// A tiny, dependency-free SVG line sparkline for dense contexts (the
// events table's per-row trend). Deliberately simpler than TrendChart —
// no fills, dots, axis labels, or per-day hover — so dozens can render in
// a table without the tooltip/markup weight. Stretched to its box with
// `preserveAspectRatio="none"` + a non-scaling stroke, like TrendChart.

const W = 100;
const H = 100;
const PAD = 12;

export function MiniSparkline({
  values,
  color,
  className = 'h-6 w-24',
}: {
  values: number[];
  color: string;
  className?: string;
}) {
  if (values.length === 0) return null;
  const max = Math.max(...values, 1);
  const n = values.length;
  const points = values
    .map((v, i) => {
      const x = n > 1 ? (i / (n - 1)) * W : W / 2;
      const y = H - PAD - (v / max) * (H - 2 * PAD);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className={className} aria-hidden>
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
