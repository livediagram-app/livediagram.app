'use client';

// Line, Area and Scatter charts (docs/specs/009-elements/pie-chart.md "Chart types"): a 2-D chart — shared x-axis `lineCategories` and one or
// more named `lineSeries`, each drawn as a polyline with point markers in the
// theme palette, with an optional legend listing the series. Data is edited as
// a grid (or imported from CSV) via the Data menu. Reuses the chart-family
// animation (`pieAnim` -> lvd-pie-*) + legend toggle. The line + point group
// animates; the axes + x-labels stay still.

import { LineChartAxis } from './ChartAxis';
import {
  AREA_FILL_OPACITY,
  chartValueFontPx,
  lineMarks,
  lineValueLabels,
  lineVariantOf,
  LINE_DEFAULT_CATEGORIES,
  LINE_DEFAULT_SERIES,
  legendFontPx,
  type ShapeElement,
} from '@livediagram/document';
import { chartAnim, chartFrame } from '@/lib/chart';
import { useChartHover } from '@/hooks/canvas/useChartHover';
import { ChartReadout } from '@/components/primitives/ChartReadout';
import { ChartSurface } from '@/components/primitives/ChartSurface';
import { ChartValues } from '@/components/primitives/ChartValues';

export function LineChartView({
  element,
  fontFamily,
  textColor,
  palette,
  ground,
}: {
  element: ShapeElement;
  fontFamily?: string;
  textColor: string;
  palette?: readonly string[];
  // What the chart sits on (chartPageGrounds): its series drawn adapted to it.
  ground?: readonly string[];
}) {
  const { w, h, colorAt, area, legend } = chartFrame(element, palette, ground);
  const { hover, markProps } = useChartHover<{ s: number; i: number }>(
    (a, b) => a.s === b.s && a.i === b.i,
  );
  const categories =
    element.lineCategories && element.lineCategories.length > 0
      ? element.lineCategories
      : LINE_DEFAULT_CATEGORIES;
  const series =
    element.lineSeries && element.lineSeries.length > 0 ? element.lineSeries : LINE_DEFAULT_SERIES;
  // Line, Area or Scatter, laid out by the marks the export draws too.
  const m = lineMarks(
    area,
    categories,
    series,
    lineVariantOf(element),
    0,
    0,
    element.chartAxis === true,
  );
  // The second axis's labels in its first series' colour.
  const right = Math.max(
    0,
    series.findIndex((s) => s.axis === 'right'),
  );
  const { x: plotX0, y: plotY0, w: plotW, h: plotH } = m.plot;
  const pointAt = (s: number, i: number) => m.points[s]?.[i] ?? { x: 0, y: 0 };
  const valAt = (s: number, i: number) => series[s]?.values[i] ?? 0;

  const group = chartAnim(element, `${plotX0 + plotW / 2}px ${plotY0 + plotH / 2}px`);
  const legendItems = series.map((s) => ({ label: s.name, value: 0, color: s.color }));

  return (
    <ChartSurface
      w={w}
      h={h}
      items={legendItems}
      colorAt={colorAt}
      legend={legend}
      textColor={textColor}
      fontFamily={fontFamily}
      fontPx={legendFontPx(element.textSize)}
      readout={
        hover ? (
          <ChartReadout
            leftPct={(pointAt(hover.s, hover.i).x / w) * 100}
            topPct={(pointAt(hover.s, hover.i).y / h) * 100}
            label={`${categories[hover.i] ?? ''} · ${series[hover.s]?.name ?? ''}`}
            value={valAt(hover.s, hover.i)}
          />
        ) : null
      }
    >
      {/* Axes: Show Axis's ticks and gridlines, then the plot's two edges. */}
      <LineChartAxis
        marks={m}
        rightColor={colorAt(right, series[right] ?? {})}
        textColor={textColor}
        fontFamily={fontFamily}
      />
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
          return (
            <g key={si}>
              {m.areas[si] ? (
                <path d={m.areas[si]} fill={color} fillOpacity={AREA_FILL_OPACITY} />
              ) : null}
              {m.lines[si] ? (
                <polyline
                  points={m.lines[si]}
                  fill="none"
                  stroke={color}
                  strokeWidth={2}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
              ) : null}
              {m.points[si]!.map((p, i) => (
                <circle
                  key={i}
                  cx={p.x}
                  cy={p.y}
                  r={m.dot}
                  fill={color}
                  {...markProps({ s: si, i })}
                />
              ))}
            </g>
          );
        })}
      </g>
      {/* X-axis labels: the categories, shortened only past the gap to the next one (chartAxisLabel), or a
          scatter's numbers. */}
      {m.labels.map((l, i) => (
        <text
          key={i}
          x={l.x}
          y={plotY0 + plotH + 13}
          textAnchor="middle"
          fontSize={9}
          fill={textColor}
          fontFamily={fontFamily}
        >
          {l.text}
        </text>
      ))}
      {element.chartValues ? (
        <ChartValues
          labels={lineValueLabels(m, series)}
          textColor={textColor}
          fillOf={() => textColor}
          fontPx={chartValueFontPx(element.textSize)}
          fontFamily={fontFamily}
        />
      ) : null}
    </ChartSurface>
  );
}
