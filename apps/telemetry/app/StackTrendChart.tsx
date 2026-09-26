'use client';

import { Tooltip } from '@livediagram/ui';
import { fmtDay } from './chart-utils';
import { linePath, plot, VIEW_H, VIEW_W } from './TrendChart';

// Several 30-day series on one shared axis: the combined chart on a chart
// stack's head card (docs/specs/017-telemetry/telemetry.md). Same inline-SVG approach as TrendChart (a
// stretched 0..100 viewBox, non-scaling strokes, transparent hover columns),
// but one coloured line per series and no fill or average line, which would
// muddy once lines overlap. Every series shares one max so their heights
// compare honestly. The selected window is a shaded band, the lines before it
// are drawn thinner and faded rather than greyed, since grey would lose which
// line is which.

export type StackSeries = { label: string; color: string; values: number[] };

export function StackTrendChart({
  days,
  series,
  highlightFromIndex = null,
  heightClassName = 'h-20',
}: {
  days: number[];
  series: StackSeries[];
  highlightFromIndex?: number | null;
  heightClassName?: string;
}) {
  const max = Math.max(1, ...series.flatMap((s) => s.values));
  const plotted = series.map((s) => ({ ...s, points: plot(s.values, max) }));
  const n = days.length;
  const from =
    highlightFromIndex == null ? 0 : Math.max(0, Math.min(highlightFromIndex, Math.max(n - 1, 0)));
  const activeFromX = n > 1 ? (from / (n - 1)) * VIEW_W : 0;

  return (
    <div className={`relative w-full ${heightClassName}`}>
      <svg
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        preserveAspectRatio="none"
        className="absolute inset-0 h-full w-full overflow-visible"
        aria-hidden
      >
        {from > 0 ? (
          <rect
            x={activeFromX}
            y={0}
            width={VIEW_W - activeFromX}
            height={VIEW_H}
            className="fill-slate-400"
            opacity={0.08}
          />
        ) : null}
        {plotted.map((s) => (
          <g key={s.label}>
            <path
              d={linePath(s.points)}
              fill="none"
              stroke={s.color}
              strokeWidth={1.25}
              opacity={0.4}
              vectorEffect="non-scaling-stroke"
            />
            <path
              d={linePath(s.points.slice(from))}
              fill="none"
              stroke={s.color}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
          </g>
        ))}
      </svg>
      {/* Transparent per-day hover columns: every series' count that day. */}
      <div className="absolute inset-0 flex">
        {days.map((day, i) => (
          <Tooltip
            key={day}
            title={fmtDay(day)}
            description={series
              .map((s) => `${s.label} ${(s.values[i] ?? 0).toLocaleString()}`)
              .join(' · ')}
            className="h-full flex-1"
          >
            <div className="h-full w-full" />
          </Tooltip>
        ))}
      </div>
    </div>
  );
}
