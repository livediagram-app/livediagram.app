'use client';

import { fmtDay } from './chart-utils';
import {
  headlineCaption,
  headlineMembers,
  headlineTotal,
  stackDrawsLines,
  type MetricStack,
} from './metric-series';
import { stackAccent } from './stack-colours';
import { StackDeck } from './StackDeck';
import { StackTrendChart, type StackSeries } from './StackTrendChart';
import { TrendBadge } from './TrendBadge';

// The head card of a chart stack (spec/22): the members' combined count and
// their lines on one chart, in the shared deck frame (StackDeck).
export function MetricStackCard({
  stack,
  series,
  counts,
  days,
  highlightFromIndex,
  previousCounts,
  against,
  expanded,
  onToggle,
}: {
  stack: MetricStack;
  series: StackSeries[];
  counts: number[]; // selected-window count per member, same order as series
  days: number[] | undefined;
  highlightFromIndex: number | null;
  // Each member's count over the span before the window (same order), and
  // that span's name, for the trend arrow; null when there's none.
  previousCounts: (number | null)[];
  against: string | null;
  expanded: boolean;
  // Hands back the head element, which gets focus back when the modal closes.
  onToggle: (anchor: HTMLElement) => void;
}) {
  const total = headlineTotal(stack, counts) ?? 0;
  const before = headlineTotal(stack, previousCounts);
  const inHeadline = headlineMembers(stack);
  const caption = headlineCaption(stack);
  const accent = stackAccent(stack.members);
  const { chart, legend, hidden } = headView(stack.title, series, counts, inHeadline, accent);

  return (
    <StackDeck
      title={stack.title}
      noun="charts"
      count={stack.members.length}
      accent={accent}
      expanded={expanded}
      onToggle={onToggle}
      aside={
        <div className="flex shrink-0 items-center gap-2">
          {before !== null && against ? (
            <TrendBadge now={total} before={before} rising={stack.rising} against={against} />
          ) : null}
          <span className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
            {total.toLocaleString()}
          </span>
        </div>
      }
    >
      <p className="mt-3 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
        {stack.blurb}
        {caption ? <span className="text-slate-400"> {caption}</span> : null}
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
    </StackDeck>
  );
}

// A few members' busiest charts for a summarised head's legend.
const LEGEND_TOP = 4;

type LegendEntry = { label: string; count: number; color?: string };

// What the head draws. Up to MAX_STACK_LINES members, one coloured line each
// with a matching legend. Past that the lines turn to spaghetti (Emails Sent
// has fourteen), so the chart is the members' combined line, in the stack's
// accent, and the legend names the busiest few by window count.
function headView(
  title: string,
  series: StackSeries[],
  counts: number[],
  inHeadline: boolean[],
  accent: string,
): { chart: StackSeries[]; legend: LegendEntry[]; hidden: number } {
  if (stackDrawsLines(series.length)) {
    return {
      chart: series,
      legend: series.map((s, i) => ({ label: s.label, count: counts[i] ?? 0, color: s.color })),
      hidden: 0,
    };
  }
  const days = series[0]?.values.length ?? 0;
  // The combined line sums what the head's number sums, so the two agree.
  const combined = Array.from({ length: days }, (_, d) =>
    series.reduce((sum, s, i) => (inHeadline[i] ? sum + (s.values[d] ?? 0) : sum), 0),
  );
  const ranked = series
    .map((s, i) => ({ label: s.label, count: counts[i] ?? 0 }))
    .sort((a, b) => b.count - a.count);
  return {
    chart: [{ label: title, color: accent, values: combined }],
    legend: ranked.slice(0, LEGEND_TOP),
    hidden: Math.max(0, ranked.length - LEGEND_TOP),
  };
}
