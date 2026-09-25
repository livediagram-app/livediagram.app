'use client';

import type { KeyboardEvent, MouseEvent } from 'react';
import { fmtDay } from './chart-utils';
import { stackDrawsLines, type MetricStack } from './metric-series';
import { StackTrendChart, type StackSeries } from './StackTrendChart';

// The head card of a chart stack (spec/22): the members' combined count and
// their lines on one chart, with one or two faux-card layers stepping out
// behind it so it reads as a deck (the Timeline stack's look, spec/138 §2.1).
//
// It is the stack's toggle in both states. Closed it reads "click to open";
// open, its members float in a popover anchored to it (StackPopover) while it
// stays in its cell, its layers gone and ringed, reading "click to close". The
// caller renders it unconditionally so toggling never remounts it and replays
// its arrival.
//
// A div with role="button" rather than a <button>: the chart's hover columns
// are Tooltip triggers, and interactive content inside a <button> is invalid.
export function MetricStackCard({
  stack,
  series,
  counts,
  days,
  highlightFromIndex,
  expanded,
  onToggle,
}: {
  stack: MetricStack;
  series: StackSeries[];
  counts: number[]; // selected-window count per member, same order as series
  days: number[] | undefined;
  highlightFromIndex: number | null;
  expanded: boolean;
  // Hands back the head element, which the popover anchors to.
  onToggle: (anchor: HTMLElement) => void;
}) {
  const total = counts.reduce((sum, n) => sum + n, 0);
  const count = stack.members.length;
  const { chart, legend, hidden } = headView(stack.title, series, counts);
  // Two layers at three or more, one at two, as on the Timeline.
  const deep = count >= 3 && !expanded;
  const layer =
    'pointer-events-none absolute inset-0 rounded-2xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900';
  const onKeyDown = (e: KeyboardEvent<HTMLElement>) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault();
    onToggle(e.currentTarget);
  };
  const onClick = (e: MouseEvent<HTMLElement>) => onToggle(e.currentTarget);

  return (
    // The layers step down and right into the grid gap; `mb-2 mr-2` keeps
    // the deepest one inside this cell rather than under the next. Kept while
    // open too, though the layers are gone: dropping it would widen the head
    // as it opens, and opening a stack must not move or resize anything.
    <div className="tl-fan-out-up relative mb-2 mr-2 flex h-full flex-col">
      {deep && <div aria-hidden className={`${layer} translate-x-2 translate-y-2 opacity-50`} />}
      {!expanded && (
        <div aria-hidden className={`${layer} translate-x-1 translate-y-1 opacity-75`} />
      )}
      <div
        role="button"
        tabIndex={0}
        aria-expanded={expanded}
        aria-haspopup="dialog"
        onClick={onClick}
        onKeyDown={onKeyDown}
        className={`relative flex flex-1 cursor-pointer flex-col rounded-2xl border bg-white p-5 transition-colors hover:border-slate-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 dark:bg-slate-900 dark:hover:border-slate-600 ${
          expanded
            ? 'border-sky-300 ring-4 ring-sky-100 dark:border-sky-700 dark:ring-sky-950'
            : 'border-slate-200 dark:border-slate-700'
        }`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-300">
              <StackGlyph />
            </span>
            <div>
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                {stack.title}
              </p>
              <p className="text-xs text-slate-400">
                {count} charts · click to {expanded ? 'close' : 'open'}
              </p>
            </div>
          </div>
          <span className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
            {total.toLocaleString()}
          </span>
        </div>
        <p className="mt-3 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
          {stack.blurb}
        </p>
        {/* Legend: which line is which, with each member's window count. A
            stack too big to draw one line per member shows its busiest
            members instead, uncoloured since no line matches them. */}
        <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600 dark:text-slate-300">
          {legend.map((entry) => (
            <li key={entry.label} className="flex items-center gap-1.5">
              {entry.color ? (
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: entry.color }} />
              ) : null}
              {entry.label}
              <span className="font-semibold text-slate-900 dark:text-slate-100">
                {entry.count.toLocaleString()}
              </span>
            </li>
          ))}
          {hidden > 0 ? <li className="text-slate-400">+{hidden} more</li> : null}
        </ul>
        {days ? (
          <div className="mt-auto pt-4">
            <StackTrendChart days={days} series={chart} highlightFromIndex={highlightFromIndex} />
            <div className="mt-2 flex justify-between text-[10px] text-slate-400">
              <span>{fmtDay(days[0] ?? 0)}</span>
              <span>{fmtDay(days[days.length - 1] ?? 0)}</span>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

// A few members' busiest charts for a summarised head's legend.
const LEGEND_TOP = 4;
// The combined line on a summarised head.
const TOTAL_COLOR = '#0ea5e9';

type LegendEntry = { label: string; count: number; color?: string };

// What the head draws. Up to MAX_STACK_LINES members, one coloured line each
// with a matching legend. Past that the lines turn to spaghetti (Emails Sent
// has fourteen), so the chart is the members' combined line and the legend
// names the busiest few by window count.
function headView(
  title: string,
  series: StackSeries[],
  counts: number[],
): { chart: StackSeries[]; legend: LegendEntry[]; hidden: number } {
  if (stackDrawsLines(series.length)) {
    return {
      chart: series,
      legend: series.map((s, i) => ({ label: s.label, count: counts[i] ?? 0, color: s.color })),
      hidden: 0,
    };
  }
  const days = series[0]?.values.length ?? 0;
  const combined = Array.from({ length: days }, (_, d) =>
    series.reduce((sum, s) => sum + (s.values[d] ?? 0), 0),
  );
  const ranked = series
    .map((s, i) => ({ label: s.label, count: counts[i] ?? 0 }))
    .sort((a, b) => b.count - a.count);
  return {
    chart: [{ label: title, color: TOTAL_COLOR, values: combined }],
    legend: ranked.slice(0, LEGEND_TOP),
    hidden: Math.max(0, ranked.length - LEGEND_TOP),
  };
}

// Three offset cards: the stack itself, rather than any one member's event.
function StackGlyph() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="3" y="3" width="13" height="10" rx="2" />
      <path d="M7 17h11a2 2 0 0 0 2-2V8" />
      <path d="M11 21h8" opacity="0.6" />
    </svg>
  );
}
