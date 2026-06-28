'use client';

import { useMemo } from 'react';
import { metricKey, type TelemetrySummary, type TelemetryWindowKey } from '@livediagram/api-schema';
import { categoryColor, eventLabel } from './event-vocab';
import { EventIcon } from './telemetry-event-icon';
import { TrendChart } from './TrendChart';
import { buildWindowCounts, windowHighlightFrom, windowLabel } from './windows';

// The Highlights view (spec/22, default tab): a curated grid of the key
// product metrics we most want to watch, each with the selected-window
// count and a 30-day mini trend line. Deliberately a FIXED list, not
// "top by volume" — a first-time visitor (`Participant·Created`) is low
// volume but high signal, so it must always be on screen. A metric that
// has no events in the payload renders as zero with a flat line rather
// than disappearing, so the dashboard shape is stable day to day.

type Highlight = { category: string; action: string; type: string | null; title: string };

const HIGHLIGHTS: Highlight[] = [
  { category: 'Participant', action: 'Created', type: null, title: 'New visitors' },
  { category: 'Session', action: 'SignedUp', type: null, title: 'New sign-ups' },
  { category: 'Diagram', action: 'Created', type: null, title: 'Diagrams created' },
  { category: 'Diagram', action: 'Shared', type: 'Edit', title: 'Edit links shared' },
  { category: 'Diagram', action: 'Joined', type: 'Edit', title: 'Collaborators joined' },
  { category: 'Diagram', action: 'Exported', type: 'PNG', title: 'PNG exports' },
  { category: 'Element', action: 'Added', type: 'Square', title: 'Shapes added' },
  { category: 'Comment', action: 'Added', type: null, title: 'Comments added' },
  { category: 'Tab', action: 'Created', type: null, title: 'Tabs created' },
  { category: 'UI', action: 'Toggled', type: 'Dark', title: 'Dark-mode switches' },
];

export function HighlightsView({
  summary,
  active,
}: {
  summary: TelemetrySummary;
  active: TelemetryWindowKey;
}) {
  const windowCounts = useMemo(() => buildWindowCounts(summary.windows), [summary.windows]);
  const daily = summary.daily;

  return (
    <div className="mt-8">
      <p className="text-sm text-slate-500 dark:text-slate-400">
        The key metrics we watch, for <span className="font-medium">{windowLabel(active)}</span>.
        Each card&rsquo;s line is the last 30 days; the selected window is highlighted.
      </p>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {HIGHLIGHTS.map((h) => {
          const key = metricKey(h.category, h.action, h.type);
          const count = windowCounts[active].get(key) ?? 0;
          const series = daily?.byMetric[key];
          const color = categoryColor(h.category);
          return (
            <div
              key={key}
              className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-2.5">
                  <span
                    className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                    style={{ backgroundColor: `${color}1a`, color }}
                  >
                    <EventIcon category={h.category} action={h.action} type={h.type} />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                      {h.title}
                    </p>
                    <p className="text-xs text-slate-400">
                      {h.category} · {eventLabel(h)}
                    </p>
                  </div>
                </div>
                <span className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
                  {count.toLocaleString()}
                </span>
              </div>
              {daily ? (
                <div className="mt-4">
                  <TrendChart
                    days={daily.days}
                    values={series ?? new Array(daily.days.length).fill(0)}
                    color={color}
                    highlightFromIndex={windowHighlightFrom(daily, active)}
                    heightClassName="h-20"
                  />
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
