'use client';

// Pie chart (spec/53): slices sized by value, in the default categorical
// palette (or per-slice colour), with a legend beside the pie. Rendered inside
// its boxed element so move / resize / select / group all come for free; the
// data is edited from the context menu's Data category. `pieAnim` drives a
// `lvd-pie-*` animation on the slice group (grow / pop / spin / pulse),
// deterministic + reduced-motion-safe like the other element animations. The
// first of the chart family, so the anim set is its own.

import {
  ANIMATION_SPEED_FACTOR,
  animLoops,
  PIE_DEFAULT_SLICES,
  PIE_LOOPING_ANIMS,
  PIE_PALETTE,
  type ShapeElement,
} from '@livediagram/diagram';

export function PieChartView({
  element,
  fontFamily,
  textColor,
  palette,
}: {
  element: ShapeElement;
  fontFamily?: string;
  textColor: string;
  // Default slice colours (theme-derived, spec/53). Falls back to the built-in
  // categorical palette when absent (e.g. an export with no theme context).
  palette?: readonly string[];
}) {
  const colors = palette && palette.length > 0 ? palette : PIE_PALETTE;
  const w = Math.max(1, element.width);
  const h = Math.max(1, element.height);
  const slices =
    element.pieSlices && element.pieSlices.length > 0 ? element.pieSlices : PIE_DEFAULT_SLICES;
  const total = slices.reduce((sum, s) => sum + Math.max(0, s.value), 0) || 1;
  // Legend takes a right-hand column; the pie fills the remaining left area.
  const legendW = Math.max(0, Math.min(w * 0.44, 130));
  const pieAreaW = w - legendW;
  const rad = Math.max(10, (Math.min(pieAreaW, h) * 0.86) / 2);
  const cx = pieAreaW / 2;
  const cy = h / 2;
  const colorAt = (i: number, s: { color?: string }) => s.color ?? colors[i % colors.length]!;

  // Build slice paths (clockwise from 12 o'clock). A single 100% slice draws
  // as a full circle (an arc from a point back to itself is degenerate).
  let angle = -Math.PI / 2;
  const wedges = slices.map((s, i) => {
    const frac = Math.max(0, s.value) / total;
    const a0 = angle;
    const a1 = angle + frac * Math.PI * 2;
    angle = a1;
    const color = colorAt(i, s);
    if (frac >= 0.999) return { full: true, color, d: '' };
    const large = frac > 0.5 ? 1 : 0;
    const x0 = cx + rad * Math.cos(a0);
    const y0 = cy + rad * Math.sin(a0);
    const x1 = cx + rad * Math.cos(a1);
    const y1 = cy + rad * Math.sin(a1);
    return {
      full: false,
      color,
      d: `M ${cx} ${cy} L ${x0} ${y0} A ${rad} ${rad} 0 ${large} 1 ${x1} ${y1} Z`,
    };
  });

  const anim = element.pieAnim;
  const loops = animLoops(anim, element.pieAnimRepeat, PIE_LOOPING_ANIMS);
  const groupStyle = anim
    ? ({
        transformOrigin: `${cx}px ${cy}px`,
        '--lvd-pie-speed': ANIMATION_SPEED_FACTOR[element.pieAnimSpeed ?? 'normal'],
        '--lvd-pie-iter': loops ? 'infinite' : 1,
      } as React.CSSProperties)
    : undefined;

  return (
    <div className="absolute inset-0">
      <svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${w} ${h}`}
        className="pointer-events-none absolute inset-0"
        aria-hidden
      >
        <g className={anim ? `lvd-pie-${anim}` : undefined} style={groupStyle}>
          {wedges.map((wedge, i) =>
            wedge.full ? (
              <circle key={i} cx={cx} cy={cy} r={rad} fill={wedge.color} />
            ) : (
              <path key={i} d={wedge.d} fill={wedge.color} stroke="#ffffff" strokeWidth={1} />
            ),
          )}
        </g>
      </svg>
      {legendW >= 48 ? (
        <div
          className="pointer-events-none absolute inset-y-0 right-0 flex flex-col justify-center gap-0.5 overflow-hidden pr-1"
          style={{ width: legendW, color: textColor, fontFamily }}
          aria-hidden
        >
          {slices.map((s, i) => (
            <div key={i} className="flex items-center gap-1 leading-tight">
              <span
                className="inline-block shrink-0 rounded-[2px]"
                style={{ width: 9, height: 9, backgroundColor: colorAt(i, s) }}
              />
              <span className="truncate text-[11px]">{s.label || '—'}</span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
