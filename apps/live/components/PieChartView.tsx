'use client';

// Pie chart (spec/53): slices sized by value, in the default categorical
// palette (or per-slice colour), with a legend beside the pie. Rendered inside
// its boxed element so move / resize / select / group all come for free; the
// data is edited from the context menu's Data category. `pieAnim` drives a
// `lvd-pie-*` animation on the slice group (grow / pop / spin / pulse),
// deterministic + reduced-motion-safe like the other element animations. The
// first of the chart family, so the anim set is its own.

import { type ShapeElement } from '@livediagram/diagram';
import { chartAnim, chartFrame } from '@/lib/chart';
import { useChartHover } from '@/hooks/useChartHover';
import { ChartLegend } from './ChartLegend';
import { ChartTooltip } from './ChartTooltip';

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
  const { w, h, data: slices, showLegend, colorAt } = chartFrame(element, palette);
  const { hover, markProps } = useChartHover<number>();
  const total = slices.reduce((sum, s) => sum + Math.max(0, s.value), 0) || 1;
  // Legend takes a right-hand column (toggleable, on by default); the pie fills
  // the remaining left area, or the whole box when the legend is off.
  const legendW = showLegend ? Math.max(0, Math.min(w * 0.44, 130)) : 0;
  const pieAreaW = w - legendW;
  const rad = Math.max(10, (Math.min(pieAreaW, h) * 0.86) / 2);
  const cx = pieAreaW / 2;
  const cy = h / 2;

  // Build slice paths (clockwise from 12 o'clock). A single 100% slice draws
  // as a full circle (an arc from a point back to itself is degenerate).
  let angle = -Math.PI / 2;
  const wedges = slices.map((s, i) => {
    const frac = Math.max(0, s.value) / total;
    const a0 = angle;
    const a1 = angle + frac * Math.PI * 2;
    angle = a1;
    const color = colorAt(i, s);
    // Tooltip anchor: the slice's mid-angle at ~half radius (full circle
    // anchors at the top), as a viewBox point converted to a % of the box.
    const mid = frac >= 0.999 ? -Math.PI / 2 : (a0 + a1) / 2;
    const leftPct = ((cx + rad * 0.55 * Math.cos(mid)) / w) * 100;
    const topPct = ((cy + rad * 0.55 * Math.sin(mid)) / h) * 100;
    if (frac >= 0.999) return { full: true, color, d: '', leftPct, topPct };
    const large = frac > 0.5 ? 1 : 0;
    const x0 = cx + rad * Math.cos(a0);
    const y0 = cy + rad * Math.sin(a0);
    const x1 = cx + rad * Math.cos(a1);
    const y1 = cy + rad * Math.sin(a1);
    return {
      full: false,
      color,
      d: `M ${cx} ${cy} L ${x0} ${y0} A ${rad} ${rad} 0 ${large} 1 ${x1} ${y1} Z`,
      leftPct,
      topPct,
    };
  });

  const group = chartAnim(element, `${cx}px ${cy}px`);

  return (
    <div className="absolute inset-0">
      <svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${w} ${h}`}
        className="pointer-events-none absolute inset-0"
        aria-hidden
      >
        <g className={group.className} style={group.style}>
          {wedges.map((wedge, i) =>
            wedge.full ? (
              <circle key={i} cx={cx} cy={cy} r={rad} fill={wedge.color} {...markProps(i)} />
            ) : (
              <path
                key={i}
                d={wedge.d}
                fill={wedge.color}
                stroke="#ffffff"
                strokeWidth={1}
                {...markProps(i)}
              />
            ),
          )}
        </g>
      </svg>
      {hover !== null && wedges[hover] ? (
        <ChartTooltip
          leftPct={wedges[hover]!.leftPct}
          topPct={wedges[hover]!.topPct}
          label={slices[hover]!.label}
          value={slices[hover]!.value}
        />
      ) : null}
      <ChartLegend
        items={slices}
        colorAt={colorAt}
        legendW={legendW}
        textColor={textColor}
        fontFamily={fontFamily}
      />
    </div>
  );
}
