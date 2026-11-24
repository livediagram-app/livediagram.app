// Most Used's day chart (liveworkspace/docs/specs/004-index/one-explorer.md "Most Used, in the rail"): one cell per
// UTC day of the index's 14-day window, the oldest on the left and today on the right, as GitHub's contribution chart
// reads. A day the person never opened the item stays empty; the busier the day, the stronger the cell, measured
// against the busiest day across the list (`peak`), so rows compare at a glance. Cells take the item's app colour:
// the brand under one app, each app's own under All Apps, matching its mark.

import type { App } from '@liveworkspace/index-client';
import { BRAND_APPS } from '@liveworkspace/brand';
import { memo, type CSSProperties } from 'react';

/** How strong a day's cell is: 0 for none, then four steps up to the list's busiest day. */
export function dayLevel(opens: number, peak: number): 0 | 1 | 2 | 3 | 4 {
  if (opens <= 0 || peak <= 0) return 0;
  return Math.min(4, Math.max(1, Math.ceil((opens / peak) * 4))) as 1 | 2 | 3 | 4;
}

const LEVEL_OPACITY = ['', '0.4', '0.6', '0.8', '1'] as const;

/** The chart's one sentence for a screen reader: how many of the 14 days it was opened on, and today. */
export function dayChartLabel(history: readonly number[]): string {
  const days = history.filter((n) => n > 0).length;
  const today = history[history.length - 1] ?? 0;
  const span = `Opened on ${days} of the last ${history.length} days`;
  return today > 0 ? `${span}, ${today === 1 ? 'once' : `${today} times`} today` : span;
}

export const DayChart = memo(function DayChart({
  history,
  peak,
  app,
}: {
  history: readonly number[];
  peak: number;
  app: App;
}) {
  const { ramp } = BRAND_APPS[app];
  // The ramp's 600 on a light panel, its 400 on a dark one, so a quiet day still reads on both.
  const colours = { '--day': ramp[600], '--day-dark': ramp[400] } as CSSProperties;
  return (
    <span
      role="img"
      aria-label={dayChartLabel(history)}
      data-day-chart=""
      className="flex gap-[3px]"
      style={colours}
    >
      {history.map((opens, i) => {
        const level = dayLevel(opens, peak);
        return (
          <span
            key={i}
            data-day-level={level}
            className={`h-2.5 w-[7px] shrink-0 rounded-[2px] ${level ? 'bg-[var(--day)] dark:bg-[var(--day-dark)]' : 'bg-slate-200/80 dark:bg-slate-700/45'}`}
            style={level ? { opacity: LEVEL_OPACITY[level] } : undefined}
          />
        );
      })}
    </span>
  );
});
