'use client';

// Line, Area and Scatter charts (each product's docs/specs/009-elements/pie-chart.md "Chart types"): shared x-axis
// `lineCategories` and one or more named `lineSeries`, each a smooth line (chart-style.ts smoothPath) with small beads
// at its points and a full dot at its end, an area's fill fading down to the baseline, in the theme palette, with an
// optional legend of the series. Laid out by the marks the export draws too (chart-marks.ts). The marks animate; the
// axes and labels stay still. One copy for every product; each binds its animation.

import { LineChartAxis } from '../ChartAxis';
import { chartFrame } from '@liveworkspace/element-model/chart-frame';
import { lineMarks } from '@liveworkspace/element-model/chart-marks';
import {
  AREA_FILL_FOOT_OPACITY,
  AREA_FILL_TOP_OPACITY,
  areaFadeId,
  CHART_BASELINE_OPACITY,
  chartLegendPx,
  chartTickPx,
  chartValuePx,
} from '@liveworkspace/element-model/chart-style';
import { lineVariantOf } from '@liveworkspace/element-model/chart-types';
import { lineValueLabels } from '@liveworkspace/element-model/chart-values';
import {
  LINE_DEFAULT_CATEGORIES,
  LINE_DEFAULT_SERIES,
} from '@liveworkspace/element-model/data-shapes';
import { useChartHover } from '../../../hooks/canvas/useChartHover';
import { ChartReadout } from '../../primitives/ChartReadout';
import { ChartSurface } from '../../primitives/ChartSurface';
import { ChartValues } from '../../primitives/ChartValues';
import type { ChartAnimOf, ChartViewProps } from './chart-view-props';

// A point's hover target: wider than its bead, so a 5px bead is easy to find.
const HIT_RADIUS = 8;

export function LineChartView({
  element,
  fontFamily,
  textColor,
  palette,
  ground,
  anim,
}: ChartViewProps & { anim: ChartAnimOf }) {
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
  const tickPx = chartTickPx(element);
  const m = lineMarks(
    area,
    categories,
    series,
    lineVariantOf(element),
    0,
    0,
    element.chartAxis === true,
    tickPx,
  );
  // The second axis's edge in its first series' colour.
  const right = Math.max(
    0,
    series.findIndex((s) => s.axis === 'right'),
  );
  const { x: plotX0, y: plotY0, w: plotW, h: plotH } = m.plot;
  const pointAt = (s: number, i: number) => m.points[s]?.[i] ?? { x: 0, y: 0 };
  const valAt = (s: number, i: number) => series[s]?.values[i] ?? 0;

  const group = anim(`${plotX0 + plotW / 2}px ${plotY0 + plotH / 2}px`);
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
      fontPx={chartLegendPx(element)}
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
      <LineChartAxis
        marks={m}
        rightColor={colorAt(right, series[right] ?? {})}
        textColor={textColor}
        fontFamily={fontFamily}
        fontPx={tickPx}
      />
      <line
        x1={plotX0}
        y1={plotY0 + plotH}
        x2={plotX0 + plotW}
        y2={plotY0 + plotH}
        stroke={textColor}
        strokeOpacity={CHART_BASELINE_OPACITY}
        strokeWidth={1}
      />
      <g className={group.className} style={group.style}>
        {series.map((s, si) => {
          const color = colorAt(si, s);
          const pts = m.points[si]!;
          const fadeId = areaFadeId(element.id, si);
          return (
            <g key={si}>
              {m.areas[si] ? (
                <>
                  <defs>
                    <linearGradient id={fadeId} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0" stopColor={color} stopOpacity={AREA_FILL_TOP_OPACITY} />
                      <stop offset="1" stopColor={color} stopOpacity={AREA_FILL_FOOT_OPACITY} />
                    </linearGradient>
                  </defs>
                  <path d={m.areas[si]} fill={`url(#${fadeId})`} />
                </>
              ) : null}
              {m.lines[si] ? (
                <path
                  d={m.lines[si]}
                  fill="none"
                  stroke={color}
                  strokeWidth={m.width}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
              ) : null}
              {pts.map((p, i) => (
                <circle
                  key={i}
                  cx={p.x}
                  cy={p.y}
                  r={i === pts.length - 1 ? m.endDot : m.dot}
                  fill={color}
                />
              ))}
            </g>
          );
        })}
      </g>
      {/* Hover targets over every point, invisible and larger than the beads they stand for. */}
      <g fill="transparent" data-chart-hits="">
        {m.points.map((pts, si) =>
          pts.map((p, i) => (
            <circle
              key={`${si}-${i}`}
              cx={p.x}
              cy={p.y}
              r={Math.max(HIT_RADIUS, m.endDot + 3)}
              {...markProps({ s: si, i })}
            />
          )),
        )}
      </g>
      {/* X-axis labels: the categories, shortened only past the gap to the next one (chartAxisLabel), or a
          scatter's numbers. */}
      {m.labels.map((l, i) => (
        <text
          key={i}
          x={l.x}
          y={m.labelY}
          textAnchor="middle"
          fontSize={tickPx}
          fill={textColor}
          fontFamily={fontFamily}
        >
          {l.text}
        </text>
      ))}
      {element.chartValues ? (
        <ChartValues
          labels={lineValueLabels(m, series, chartValuePx(element))}
          textColor={textColor}
          fillOf={() => textColor}
          fontPx={chartValuePx(element)}
          fontFamily={fontFamily}
        />
      ) : null}
    </ChartSurface>
  );
}
