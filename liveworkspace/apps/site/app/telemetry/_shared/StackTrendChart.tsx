'use client';

import { useCallback, useMemo } from 'react';
import { ChartHover } from './chart-hover/ChartHover';
import { useEmphasis, useEmphasisStore, type EmphasisStore } from './chart-hover/emphasis';
import { dayHeading } from './chart-hover/hover-model';
import { linePath, plot, VIEW_H, VIEW_W } from './TrendChart';

// Several 30-day series on one shared axis: the combined chart on a chart
// stack's head card (docs/specs/017-telemetry/telemetry.md). Same inline-SVG approach as TrendChart (a
// stretched 0..100 viewBox, non-scaling strokes, the shared hover overlay),
// but one coloured line per series and no fill or average line, which would
// muddy once lines overlap. Every series shares one max so their heights
// compare honestly. The selected window is a shaded band, the lines before it
// are drawn thinner and faded rather than greyed, since grey would lose which
// line is which.

// `app` scopes the series to an app's accent: its group carries `data-app`, so a `color` of
// `var(--color-brand-500)` is that app's (telemetry.css), as All apps' comparison draws each app. `className` styles
// the group (a neutral Total in `currentColor`), and `dashed` draws the line dashed. `key` names the line where two
// could share a label (the label otherwise); `total` makes it the tooltip's Total row.
export type StackSeries = {
  key?: string;
  label: string;
  color: string;
  values: number[];
  app?: string;
  className?: string;
  dashed?: boolean;
  total?: boolean;
};

export function StackTrendChart({
  days,
  series,
  highlightFromIndex = null,
  heightClassName = 'h-20',
  label = 'Events per day, last 30 days',
  totalLabel,
  emphasis,
}: {
  days: number[];
  series: StackSeries[];
  highlightFromIndex?: number | null;
  heightClassName?: string;
  // The chart's accessible name, and the tooltip's Total row for lines that add up (Tooltips).
  label?: string;
  totalLabel?: string;
  // Shared with a legend outside the chart; the chart keeps its own otherwise.
  emphasis?: EmphasisStore;
}) {
  const own = useEmphasisStore();
  const store = emphasis ?? own;
  const emphasised = useEmphasis(store);
  const plotted = useMemo(() => {
    let max = 1;
    for (const s of series) for (const v of s.values) if (v > max) max = v;
    return series.map((s) => {
      const points = plot(s.values, max);
      return { ...s, key: s.key ?? s.label, points, y: points.map((p) => p.y) };
    });
  }, [series]);
  const heading = useCallback((i: number) => dayHeading(days[i] ?? 0), [days]);
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
          <g
            key={s.key}
            data-app={s.app}
            data-series={s.key}
            className={`transition-opacity duration-100 motion-reduce:transition-none ${s.className ?? ''}`}
            style={{ opacity: emphasised !== null && emphasised !== s.key ? 0.25 : 1 }}
          >
            <path
              d={linePath(s.points)}
              fill="none"
              stroke={s.color}
              strokeWidth={1.25}
              strokeDasharray={s.dashed ? '4 3' : undefined}
              opacity={0.4}
              vectorEffect="non-scaling-stroke"
            />
            <path
              d={linePath(s.points.slice(from))}
              fill="none"
              stroke={s.color}
              strokeWidth={2}
              strokeDasharray={s.dashed ? '4 3' : undefined}
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
          </g>
        ))}
      </svg>
      <ChartHover
        n={n}
        series={plotted}
        heading={heading}
        label={label}
        totalLabel={totalLabel}
        emphasis={store}
      />
    </div>
  );
}
