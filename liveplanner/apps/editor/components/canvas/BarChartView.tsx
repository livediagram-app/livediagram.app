'use client';

// Column and Bar charts (docs/specs/009-elements/pie-chart.md "Chart types"): upright or horizontal bars sized by value, in the theme-derived
// palette (or per-datum colour), with an optional legend — the bar sibling of
// PieChartView, sharing the same data (`pieSlices`), animation (`pieAnim`), and
// legend toggle (`chartLegend`). Rendered inside its boxed element; the data is
// edited from the context menu's Data category. The slice group carries the
// `lvd-pie-*` animation (grow / pop / spin / pulse), reduced-motion-safe.

import {
  barMarks,
  barValueLabels,
  chartTypeOf,
  chartValueFontPx,
  legendFontPx,
  type ShapeElement,
} from '@liveplanner/project';
import { ChartValues } from '@/components/primitives/ChartValues';
import { BarChartAxis } from './ChartAxis';
import { useChartAnim, chartFrame } from '@/lib/chart';
import { useChartHover } from '@liveworkspace/workbench/hooks/canvas/useChartHover';
import { ChartReadout } from '@liveworkspace/workbench/components/primitives/ChartReadout';
import { ChartSurface } from '@/components/primitives/ChartSurface';

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
  const { w, h, data, colorAt, area, legend } = chartFrame(element, palette);
  const { hover, markProps } = useChartHover<number>();
  // Upright columns, or (the Bar chart type) bars to the right; laid out by the marks the export draws too.
  const horizontal = chartTypeOf(element) === 'bar';
  const marks = barMarks(area, data, horizontal, 0, 0, element.chartAxis === true);
  const { baseline, bars, origin } = marks;
  const valuePx = chartValueFontPx(element.textSize);
  const group = useChartAnim(element, `${origin.x}px ${origin.y}px`);

  return (
    <ChartSurface
      w={w}
      h={h}
      items={data}
      colorAt={colorAt}
      legend={legend}
      textColor={textColor}
      fontFamily={fontFamily}
      fontPx={legendFontPx(element.textSize)}
      readout={
        hover !== null && data[hover] && bars[hover] ? (
          <ChartReadout
            leftPct={(bars[hover].tip.x / w) * 100}
            topPct={(bars[hover].tip.y / h) * 100}
            label={data[hover].label}
            value={data[hover].value}
          />
        ) : null
      }
    >
      {/* Baseline. */}
      <BarChartAxis
        marks={marks}
        horizontal={horizontal}
        textColor={textColor}
        fontFamily={fontFamily}
      />
      <line
        x1={baseline.x1}
        y1={baseline.y1}
        x2={baseline.x2}
        y2={baseline.y2}
        stroke="#cbd5e1"
        strokeWidth={1}
      />
      <g className={group.className} style={group.style}>
        {bars.map((bar, i) => (
          <rect
            key={i}
            x={bar.x}
            y={bar.y}
            width={bar.w}
            height={bar.h}
            rx={bar.rx}
            fill={colorAt(i, data[i]!)}
            {...markProps(i)}
          />
        ))}
      </g>
      {element.chartValues ? (
        <ChartValues
          labels={barValueLabels(marks, data, horizontal, valuePx)}
          textColor={textColor}
          fillOf={(i) => colorAt(i, data[i]!)}
          fontPx={valuePx}
          fontFamily={fontFamily}
        />
      ) : null}
    </ChartSurface>
  );
}
