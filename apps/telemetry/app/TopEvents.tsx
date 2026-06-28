'use client';

import { Tooltip } from '@livediagram/ui';
import type { TelemetryCount } from '@livediagram/api-schema';
import { pct } from './chart-utils';
import { categoryColor, eventExplanation, eventLabel } from './event-vocab';
import { EventIcon } from './telemetry-event-icon';

// Top-N leaderboard (spec/22), reworked from the old cramped single-line
// rows (a w-32 truncated label squeezed beside a thin bar). Now each row
// is a rank + coloured icon chip + a full-width label over a chunky
// proportional bar, with the count and its share of the window. Bars are
// scaled to the leader so #1 fills the track and the rest read relative.

export function TopEvents({
  rows,
  total,
  n = 10,
}: {
  rows: TelemetryCount[];
  total: number;
  n?: number;
}) {
  const sorted = [...rows].sort((a, b) => b.count - a.count).slice(0, n);
  if (sorted.length === 0) return null;
  const top = sorted[0]?.count ?? 1;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
      <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
        Top {sorted.length} events
      </p>
      <ul className="mt-4 flex flex-col gap-3">
        {sorted.map((row, i) => {
          const color = categoryColor(row.category);
          return (
            <Tooltip
              key={`${row.category}:${row.action}:${row.type ?? ''}`}
              title={`${row.category} · ${eventLabel(row)}`}
              description={eventExplanation(row.category, row.action, row.type ?? null)}
              block
            >
              <li className="flex items-center gap-3">
                <span className="w-4 shrink-0 text-right text-xs font-medium tabular-nums text-slate-400">
                  {i + 1}
                </span>
                <span
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md"
                  style={{ backgroundColor: `${color}1a`, color }}
                >
                  <EventIcon category={row.category} action={row.action} type={row.type ?? null} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2 text-sm">
                    <span className="truncate text-slate-700 dark:text-slate-200">
                      {row.category} · {eventLabel(row)}
                    </span>
                    <span className="shrink-0 font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                      {row.count.toLocaleString()}
                      <span className="ml-1 text-xs font-normal text-slate-400">
                        {pct(row.count, total).toFixed(0)}%
                      </span>
                    </span>
                  </div>
                  <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${pct(row.count, top)}%`, backgroundColor: color }}
                    />
                  </div>
                </div>
              </li>
            </Tooltip>
          );
        })}
      </ul>
    </div>
  );
}
