'use client';

// Column and Bar charts (each product's docs/specs/009-elements/pie-chart.md "Chart types"): upright or horizontal
// bars sized by value, in the theme-derived palette (or a per-datum colour), with an optional legend, the bar sibling
// of PieChartView, sharing its data (`pieSlices`), animation (`pieAnim`) and legend toggle (`chartLegend`). Laid out by
// the marks the export draws too (chart-marks.ts) and drawn in the shared look (chart-style.ts): rounded value ends,
// square at a baseline in the chart's own text colour, faded. One copy for every product; each binds its animation.

import { BarChartAxis } from '../ChartAxis';
import { chartFrame } from '@liveworkspace/element-model/chart-frame';
import { barMarks } from '@liveworkspace/element-model/chart-marks';
import {
  CHART_BASELINE_OPACITY,
  chartLegendPx,
  chartTickPx,
  chartValuePx,
} from '@liveworkspace/element-model/chart-style';
import { chartTypeOf } from '@liveworkspace/element-model/chart-types';
import { barCategoryLabels, barValueLabels } from '@liveworkspace/element-model/chart-values';
import { useChartHover } from '../../../hooks/canvas/useChartHover';
import { ChartReadout } from '../../primitives/ChartReadout';
import { ChartSurface } from '../../primitives/ChartSurface';
import { ChartValues } from '../../primitives/ChartValues';
import type { ChartAnimOf, ChartViewProps } from './chart-view-props';

export function BarChartView({
  element,
  fontFamily,
  textColor,
  palette,
  ground,
  anim,
}: ChartViewProps & { anim: ChartAnimOf }) {
  const { w, h, data, colorAt, area, legend } = chartFrame(element, palette, ground);
  const { hover, markProps } = useChartHover<number>();
  const horizontal = chartTypeOf(element) === 'bar';
  const tickPx = chartTickPx(element);
  const marks = barMarks(area, data, horizontal, 0, 0, element.chartAxis === true, tickPx);
  const { baseline, bars, origin } = marks;
  const valuePx = chartValuePx(element);
  const group = anim(`${origin.x}px ${origin.y}px`);

  return (
    <ChartSurface
      w={w}
      h={h}
      items={data}
      colorAt={colorAt}
      legend={legend}
      textColor={textColor}
      fontFamily={fontFamily}
      fontPx={chartLegendPx(element)}
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
      <BarChartAxis
        marks={marks}
        horizontal={horizontal}
        textColor={textColor}
        fontFamily={fontFamily}
        fontPx={tickPx}
      />
      <line
        x1={baseline.x1}
        y1={baseline.y1}
        x2={baseline.x2}
        y2={baseline.y2}
        stroke={textColor}
        strokeOpacity={CHART_BASELINE_OPACITY}
        strokeWidth={1}
      />
      <g className={group.className} style={group.style}>
        {bars.map((bar, i) => (
          <path key={i} d={bar.d} fill={colorAt(i, data[i]!)} {...markProps(i)} />
        ))}
      </g>
      {/* Each bar named on its axis: under a column, left of a bar (a one-hue chart's key). */}
      <ChartValues
        labels={barCategoryLabels(marks, data, horizontal, tickPx)}
        textColor={textColor}
        fillOf={(i) => colorAt(i, data[i]!)}
        fontPx={tickPx}
        fontFamily={fontFamily}
      />
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
