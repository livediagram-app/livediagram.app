'use client';

// Pie and Doughnut charts (docs/specs/009-elements/pie-chart.md "Chart types"): slices sized by value, in the default categorical
// palette (or per-slice colour), with a legend beside the pie. Rendered inside
// its boxed element so move / resize / select / group all come for free; the
// data is edited from the context menu's Data category. `pieAnim` drives a
// `lvd-pie-*` animation on the slice group (grow / pop / spin / pulse),
// deterministic + reduced-motion-safe like the other element animations. The
// first of the chart family, so the anim set is its own.

import {
  chartTypeOf,
  chartValueFontPx,
  legendFontPx,
  pieMarks,
  pieValueLabels,
  type ShapeElement,
} from '@livedesign/design';
import { ChartValues } from '@/components/primitives/ChartValues';
import { useChartAnim, chartFrame } from '@/lib/chart';
import { useChartHover } from '@/hooks/canvas/useChartHover';
import { ChartReadout } from '@/components/primitives/ChartReadout';
import { ChartSurface } from '@/components/primitives/ChartSurface';

export function PieChartView({
  element,
  fontFamily,
  textColor,
  palette,
  ground,
}: {
  element: ShapeElement;
  fontFamily?: string;
  textColor: string;
  // Default slice colours (theme-derived, docs/specs/009-elements/pie-chart.md). Falls back to the built-in
  // categorical palette when absent (e.g. an export with no theme context).
  palette?: readonly string[];
  // What the chart sits on (chartPageGrounds): its series drawn adapted to it.
  ground?: readonly string[];
}) {
  const { w, h, data: slices, colorAt, area, legend } = chartFrame(element, palette, ground);
  const { hover, markProps } = useChartHover<number>();
  // The pie (or doughnut) fills the chart area chartFrame leaves after the legend strip, laid out by the marks the
  // export draws too.
  const doughnut = chartTypeOf(element) === 'doughnut';
  const pie = pieMarks(area, slices, doughnut);
  const { cx, cy, rad, wedges } = pie;
  const valuePx = chartValueFontPx(element.textSize);

  const group = useChartAnim(element, `${cx}px ${cy}px`);

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
              stroke="#ffffff"
              strokeWidth={1}
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
