'use client';

// Pie and Doughnut charts (each product's docs/specs/009-elements/pie-chart.md "Chart types"): wedges sized by value,
// clockwise from twelve o'clock, in the theme-derived palette (or a per-slice colour), with a legend. Laid out by the
// marks the export draws too (chart-marks.ts): each wedge set apart from its neighbours by a clear gap the ground
// shows through, on a light page or a dark one. One copy for every product; each binds its animation.

import { chartFrame } from '@liveworkspace/element-model/chart-frame';
import { pieMarks } from '@liveworkspace/element-model/chart-marks';
import { chartTypeOf } from '@liveworkspace/element-model/chart-types';
import { chartValueFontPx, pieValueLabels } from '@liveworkspace/element-model/chart-values';
import { legendFontPx } from '@liveworkspace/model-core/label-font';
import { useChartHover } from '../../../hooks/canvas/useChartHover';
import { ChartReadout } from '../../primitives/ChartReadout';
import { ChartSurface } from '../../primitives/ChartSurface';
import { ChartValues } from '../../primitives/ChartValues';
import type { ChartAnimOf, ChartViewProps } from './chart-view-props';

export function PieChartView({
  element,
  fontFamily,
  textColor,
  palette,
  ground,
  anim,
}: ChartViewProps & { anim: ChartAnimOf }) {
  const { w, h, data: slices, colorAt, area, legend } = chartFrame(element, palette, ground);
  const { hover, markProps } = useChartHover<number>();
  const doughnut = chartTypeOf(element) === 'doughnut';
  const pie = pieMarks(area, slices, doughnut);
  const { cx, cy, rad, wedges } = pie;
  const valuePx = chartValueFontPx(element.textSize);
  const group = anim(`${cx}px ${cy}px`);

  return (
    <ChartSurface
      w={w}
      h={h}
      items={slices}
      colorAt={colorAt}
      legend={legend}
      textColor={textColor}
      fontFamily={fontFamily}
      fontPx={legendFontPx(element.textSize)}
      readout={
        hover !== null && wedges[hover] ? (
          <ChartReadout
            leftPct={(wedges[hover].tip.x / w) * 100}
            topPct={(wedges[hover].tip.y / h) * 100}
            label={slices[hover]!.label}
            value={slices[hover]!.value}
          />
        ) : null
      }
    >
      <g className={group.className} style={group.style}>
        {wedges.map((wedge, i) =>
          wedge.full && !doughnut ? (
            <circle
              key={i}
              cx={cx}
              cy={cy}
              r={rad}
              fill={colorAt(i, slices[i]!)}
              {...markProps(i)}
            />
          ) : wedge.d ? (
            <path
              key={i}
              d={wedge.d}
              fill={colorAt(i, slices[i]!)}
              fillRule={doughnut ? 'evenodd' : undefined}
              {...markProps(i)}
            />
          ) : null,
        )}
      </g>
      {element.chartValues ? (
        <ChartValues
          labels={pieValueLabels(pie, slices, valuePx)}
          textColor={textColor}
          fillOf={(i) => colorAt(i, slices[i]!)}
          fontPx={valuePx}
          fontFamily={fontFamily}
        />
      ) : null}
    </ChartSurface>
  );
}
