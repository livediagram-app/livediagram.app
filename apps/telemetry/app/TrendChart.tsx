'use client';

import { Tooltip } from '@livediagram/ui';
import { fmtDay } from './chart-utils';

// A standalone inline-SVG line chart for a 30-day daily series, shared by
// the Raw view's timeframe panel and the Search view's per-metric trend.
// No charting library: the path is plotted into a 0..100 viewBox and
// stretched to the container with `preserveAspectRatio="none"`, while
// `vector-effect="non-scaling-stroke"` keeps the stroke an even width
// despite the non-uniform scale. A transparent row of hover columns
// overlaid on top gives a per-day tooltip (date + count) without per-point
// hit-testing maths.
//
// `highlightFromIndex` marks where the selected window begins: everything
// from that index to the end is drawn in the accent colour (and its span
// shaded), the earlier context in muted slate. Pass null to treat the
// whole line as active (the Search view, which always shows 30 days).

const VIEW_W = 100;
const VIEW_H = 100;
// Vertical breathing room (in viewBox units) so the peak doesn't touch the
// top edge and a flat line doesn't sit exactly on the baseline.
const PAD_TOP = 8;

type Point = { x: number; y: number };

function plot(values: number[], max: number): Point[] {
  const n = values.length;
  return values.map((v, i) => ({
    x: n > 1 ? (i / (n - 1)) * VIEW_W : VIEW_W / 2,
    y: VIEW_H - PAD_TOP - (v / max) * (VIEW_H - PAD_TOP),
  }));
}

function linePath(points: Point[]): string {
  return points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
}

function areaPath(points: Point[]): string {
  if (points.length === 0) return '';
  const first = points[0]!;
  const last = points[points.length - 1]!;
  return `${linePath(points)} L ${last.x} ${VIEW_H} L ${first.x} ${VIEW_H} Z`;
}

export function TrendChart({
  days,
  values,
  color,
  highlightFromIndex = null,
  heightClassName = 'h-40',
}: {
  days: number[];
  values: number[];
  color: string;
  highlightFromIndex?: number | null;
  heightClassName?: string;
}) {
  const max = Math.max(...values, 1);
  const points = plot(values, max);
  const from =
    highlightFromIndex == null ? 0 : Math.max(0, Math.min(highlightFromIndex, points.length - 1));
  const activePoints = points.slice(from);
  const activeFromX = points[from]?.x ?? 0;
  const peak = Math.max(...values, 0);
  // Unique gradient id per render so two charts on one page don't collide.
  const gradientId = `trend-fill-${color.replace(/[^a-z0-9]/gi, '')}-${from}`;

  return (
    <div>
      <div className={`relative w-full ${heightClassName}`}>
        <svg
          viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
          preserveAspectRatio="none"
          className="absolute inset-0 h-full w-full overflow-visible"
          aria-hidden
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.22" />
              <stop offset="100%" stopColor={color} stopOpacity="0" />
            </linearGradient>
          </defs>
          {/* Shaded band behind the selected window. */}
          {from > 0 || highlightFromIndex == null ? (
            <rect
              x={activeFromX}
              y={0}
              width={VIEW_W - activeFromX}
              height={VIEW_H}
              fill={color}
              opacity={0.06}
            />
          ) : null}
          {/* Fill under the active region. */}
          <path d={areaPath(activePoints)} fill={`url(#${gradientId})`} />
          {/* Full line, muted: the context before the active window. */}
          <path
            d={linePath(points)}
            fill="none"
            stroke="currentColor"
            strokeWidth={1.5}
            vectorEffect="non-scaling-stroke"
            className="text-slate-300 dark:text-slate-600"
          />
          {/* Active line, accent colour, drawn on top. */}
          <path
            d={linePath(activePoints)}
            fill="none"
            stroke={color}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
        {/* Marker dot on the most recent day, in screen space so it stays
            round under the stretched viewBox. */}
        {points.length > 0 ? (
          <span
            className="absolute h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-white dark:ring-slate-900"
            style={{
              left: `${points[points.length - 1]!.x}%`,
              top: `${points[points.length - 1]!.y}%`,
              backgroundColor: color,
            }}
          />
        ) : null}
        {/* Transparent per-day hover columns for the tooltip. */}
        <div className="absolute inset-0 flex">
          {values.map((v, i) => (
            <Tooltip
              key={days[i] ?? i}
              title={fmtDay(days[i] ?? 0)}
              description={`${v.toLocaleString()} ${v === 1 ? 'event' : 'events'}`}
              className="h-full flex-1"
            >
              <div className="h-full w-full" />
            </Tooltip>
          ))}
        </div>
      </div>
      <div className="mt-2 flex justify-between text-[10px] text-slate-400">
        <span>{fmtDay(days[0] ?? 0)}</span>
        <span className="text-slate-500 dark:text-slate-400">Peak {peak.toLocaleString()}</span>
        <span>{fmtDay(days[days.length - 1] ?? 0)}</span>
      </div>
    </div>
  );
}
