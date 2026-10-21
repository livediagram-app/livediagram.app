'use client';

// Show Values (docs/specs/009-elements/pie-chart.md): each mark's number on the chart, placed by the same
// `chart-values` layout the export draws, a wedge's number in the ink that reads on its colour. Static text, drawn
// over the marks and outside the animated group, so it stays put while the marks grow.

import { labelOn, type ChartValueLabel } from '@liveplanner/document';

export function ChartValues({
  labels,
  textColor,
  fillOf,
  fontPx,
  fontFamily,
}: {
  labels: readonly ChartValueLabel[];
  textColor: string;
  fillOf: (i: number) => string;
  fontPx: number;
  fontFamily?: string;
}) {
  return (
    <g pointerEvents="none" fontFamily={fontFamily} fontSize={fontPx}>
      {labels.map((l, i) => (
        <text
          key={i}
          x={l.x}
          y={l.y}
          textAnchor={l.anchor}
          fontWeight={l.category ? undefined : 600}
          fill={l.onMark !== undefined ? labelOn(fillOf(l.onMark)) : textColor}
        >
          {l.text}
        </text>
      ))}
    </g>
  );
}
