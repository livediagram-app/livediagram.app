'use client';

// Line chart (spec/53): a 2-D chart — shared x-axis `lineCategories` and one or
// more named `lineSeries`, each drawn as a polyline with point markers in the
// theme palette, with an optional legend listing the series. Data is edited as
// a grid (or imported from CSV) via the Data menu. Reuses the chart-family
// animation (`pieAnim` -> lvd-pie-*) + legend toggle. The line + point group
// animates; the axes + x-labels stay still.

import {
  LINE_DEFAULT_CATEGORIES,
  LINE_DEFAULT_SERIES,
  type ShapeElement,
} from '@livediagram/diagram';
import { chartAnim, chartFrame } from '@/lib/chart';
import { useChartHover } from '@/hooks/useChartHover';
import { ChartLegend } from './ChartLegend';
import { ChartTooltip } from './ChartTooltip';

export function LineChartView({
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
  const { w, h, showLegend, colorAt } = chartFrame(element, palette);
  const { hover, markProps } = useChartHover<{ s: number; i: number }>(
    (a, b) => a.s === b.s && a.i === b.i,
  );
  const categories =
    element.lineCategories && element.lineCategories.length > 0
      ? element.lineCategories
      : LINE_DEFAULT_CATEGORIES;
  const series =
    element.lineSeries && element.lineSeries.length > 0 ? element.lineSeries : LINE_DEFAULT_SERIES;
  const n = categories.length;

  const legendW = showLegend ? Math.max(0, Math.min(w * 0.32, 110)) : 0;
  const padL = 10;
  const padTop = 12;
  const padBottom = 22;
  const plotX0 = padL;
  const plotW = Math.max(1, w - legendW - padL - 8);
  const plotY0 = padTop;
  const plotH = Math.max(1, h - padTop - padBottom);

  // Value range across every series, with 0 included so the baseline reads
  // naturally; guard the degenerate all-equal case so the line isn't flat at
  // the top edge.
  let minV = 0;
  let maxV = 0;
  for (const s of series)
    for (const v of s.values) {
      if (v < minV) minV = v;
      if (v > maxV) maxV = v;
    }
  if (maxV === minV) maxV = minV + 1;
  const xAt = (i: number) => (n <= 1 ? plotX0 + plotW / 2 : plotX0 + (i / (n - 1)) * plotW);
  const yAt = (v: number) => plotY0 + plotH - ((v - minV) / (maxV - minV)) * plotH;
  const valAt = (s: number, i: number) => series[s]?.values[i] ?? 0;

  const group = chartAnim(element, `${plotX0 + plotW / 2}px ${plotY0 + plotH / 2}px`);
  const legendItems = series.map((s) => ({ label: s.name, value: 0, color: s.color }));

  return (
    <div className="absolute inset-0">
      <svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${w} ${h}`}
        className="pointer-events-none absolute inset-0"
        aria-hidden
      >
        {/* Axes. */}
        <line
          x1={plotX0}
          y1={plotY0}
          x2={plotX0}
          y2={plotY0 + plotH}
          stroke="#e2e8f0"
          strokeWidth={1}
        />
        <line
          x1={plotX0}
          y1={plotY0 + plotH}
          x2={plotX0 + plotW}
          y2={plotY0 + plotH}
          stroke="#cbd5e1"
          strokeWidth={1}
        />
        <g className={group.className} style={group.style}>
          {series.map((s, si) => {
            const color = colorAt(si, s);
            const pts = categories.map((_, i) => `${xAt(i)},${yAt(valAt(si, i))}`).join(' ');
            return (
              <g key={si}>
                <polyline
                  points={pts}
                  fill="none"
                  stroke={color}
                  strokeWidth={2}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
                {categories.map((_, i) => (
                  <circle
                    key={i}
                    cx={xAt(i)}
                    cy={yAt(valAt(si, i))}
                    r={3}
                    fill={color}
                    {...markProps({ s: si, i })}
                  />
                ))}
              </g>
            );
          })}
        </g>
        {/* X-axis category labels (truncated; may overlap when very dense). */}
        {categories.map((c, i) => (
          <text
            key={i}
            x={xAt(i)}
            y={plotY0 + plotH + 13}
            textAnchor="middle"
            fontSize={9}
            fill={textColor}
            fontFamily={fontFamily}
          >
            {c.length > 6 ? `${c.slice(0, 5)}…` : c}
          </text>
        ))}
      </svg>
      {hover ? (
        <ChartTooltip
          leftPct={(xAt(hover.i) / w) * 100}
          topPct={(yAt(valAt(hover.s, hover.i)) / h) * 100}
          label={`${categories[hover.i] ?? ''} · ${series[hover.s]?.name ?? ''}`}
          value={valAt(hover.s, hover.i)}
        />
      ) : null}
      <ChartLegend
        items={legendItems}
        colorAt={colorAt}
        legendW={legendW}
        textColor={textColor}
        fontFamily={fontFamily}
      />
    </div>
  );
}
