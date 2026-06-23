'use client';

// Bar chart (spec/53): vertical bars sized by value, in the theme-derived
// palette (or per-datum colour), with an optional legend — the bar sibling of
// PieChartView, sharing the same data (`pieSlices`), animation (`pieAnim`), and
// legend toggle (`chartLegend`). Rendered inside its boxed element; the data is
// edited from the context menu's Data category. The slice group carries the
// `lvd-pie-*` animation (grow / pop / spin / pulse), reduced-motion-safe.

import { type ShapeElement } from '@livediagram/diagram';
import { chartAnim, chartFrame } from '@/lib/chart';
import { useChartHover } from '@/hooks/canvas/useChartHover';
import { ChartLegend } from './ChartLegend';
import { ChartTooltip } from './ChartTooltip';

export function BarChartView({
  element,
  fontFamily,
  textColor,
  palette,
}: {
  element: ShapeElement;
  fontFamily?: string;
  textColor: string;
  palette?: readonly string[];
}) {
  const { w, h, data, showLegend, colorAt } = chartFrame(element, palette);
  const { hover, markProps } = useChartHover<number>();
  const maxVal = data.reduce((m, d) => Math.max(m, Math.max(0, d.value)), 0) || 1;
  const legendW = showLegend ? Math.max(0, Math.min(w * 0.4, 120)) : 0;
  const barAreaW = w - legendW;

  // Bars across the bar area, baseline near the bottom (room for a value /
  // label gutter). Evenly spaced with a gap, capped bar width so a 2-bar chart
  // doesn't look like two slabs.
  const padX = Math.min(20, barAreaW * 0.08);
  const topPad = h * 0.1;
  const baseY = h * 0.88;
  const innerW = Math.max(1, barAreaW - padX * 2);
  const slot = innerW / data.length;
  const barW = Math.min(slot * 0.7, 48);
  const fullH = Math.max(1, baseY - topPad);

  const group = chartAnim(element, `${barAreaW / 2}px ${baseY}px`);

  return (
    <div className="absolute inset-0">
      <svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${w} ${h}`}
        className="pointer-events-none absolute inset-0"
        aria-hidden
      >
        {/* Baseline. */}
        <line
          x1={padX}
          y1={baseY}
          x2={barAreaW - padX}
          y2={baseY}
          stroke="#cbd5e1"
          strokeWidth={1}
        />
        <g className={group.className} style={group.style}>
          {data.map((d, i) => {
            const barH = (Math.max(0, d.value) / maxVal) * fullH;
            const cx = padX + slot * (i + 0.5);
            return (
              <rect
                key={i}
                x={cx - barW / 2}
                y={baseY - barH}
                width={barW}
                height={barH}
                rx={Math.min(3, barW / 4)}
                fill={colorAt(i, d)}
                {...markProps(i)}
              />
            );
          })}
        </g>
      </svg>
      {hover !== null && data[hover] ? (
        <ChartTooltip
          leftPct={((padX + slot * (hover + 0.5)) / w) * 100}
          topPct={((baseY - (Math.max(0, data[hover]!.value) / maxVal) * fullH) / h) * 100}
          label={data[hover]!.label}
          value={data[hover]!.value}
        />
      ) : null}
      <ChartLegend
        items={data}
        colorAt={colorAt}
        legendW={legendW}
        textColor={textColor}
        fontFamily={fontFamily}
      />
    </div>
  );
}
