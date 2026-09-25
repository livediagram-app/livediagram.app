'use client';

import { useState } from 'react';
import type { TelemetrySummary, TelemetryWindowKey } from '@livediagram/api-schema';
import { MetricCard } from './MetricCard';
import { MetricStackCard } from './MetricStackCard';
import { StackTray } from './StackTray';
import { dailySeries, isStack, metricKey, stackSeriesColor, windowCount } from './metric-series';
import { windowHighlightFrom } from './windows';

export type { Metric, MetricGroup, MetricStack } from './metric-series';
import type { MetricGroup } from './metric-series';

// Curated metrics rendered as cards: the selected-window count + a 30-day
// trend line each (MetricCard), or a chart stack (MetricStackCard) that fans
// out into its members' cards. Shared by every metric-card view so each is
// just a list of metric groups rendered identically.

// Slower than a page cascade: an expansion is a deliberate act on a handful
// of cards, so the fan is worth seeing (the Timeline's rate, spec/138 §2.6).
const EXPAND_STAGGER_MS = 60;

// The card grid, shared by a group and an open stack's tray so the tray's
// cards line up with the columns around it.
const GRID = 'grid gap-4 sm:grid-cols-2 xl:grid-cols-3';

export function MetricGroups({
  groups,
  summary,
  active,
}: {
  groups: MetricGroup[];
  summary: TelemetrySummary;
  active: TelemetryWindowKey;
}) {
  const daily = summary.daily;
  const highlightFromIndex = daily ? windowHighlightFrom(daily, active) : null;
  // The open stack in each group, by group title. One per group: two open
  // trays would sit one under the other, and the second's caret would point
  // across the first at a head it isn't under. View state only.
  const [open, setOpen] = useState<Readonly<Record<string, string>>>({});
  const toggle = (group: string, stack: string) =>
    setOpen((prev) => {
      const { [group]: current, ...rest } = prev;
      return current === stack ? rest : { ...rest, [group]: stack };
    });

  return (
    <div className="mt-6 flex flex-col gap-8">
      {groups.map((group) => (
        <section key={group.title}>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            {group.title}
          </h3>
          {/* Dense packing: an open stack's tray spans a full row, and without
              it the cards after the head would drop below the tray instead of
              finishing the head's row. */}
          <div className={`mt-3 grid-flow-row-dense ${GRID}`}>
            {group.metrics.map((item) => {
              if (!isStack(item)) {
                return (
                  <MetricCard
                    key={metricKey(item)}
                    metric={item}
                    count={windowCount(summary, active, item)}
                    series={daily ? dailySeries(daily, item) : undefined}
                    days={daily?.days}
                    highlightFromIndex={highlightFromIndex}
                  />
                );
              }
              const expanded = open[group.title] === item.title;
              const counts = item.members.map((m) => windowCount(summary, active, m));
              const series = item.members.map((m, i) => ({
                label: m.title,
                color: stackSeriesColor(i),
                values: daily ? dailySeries(daily, m) : [],
              }));
              // A pair of siblings, not a wrapper: the head keeps its own cell
              // (so opening never moves it, and never remounts it to replay
              // its arrival), and the tray takes the row beneath.
              return [
                <MetricStackCard
                  key={`stack:${item.title}`}
                  stack={item}
                  series={series}
                  counts={counts}
                  days={daily?.days}
                  highlightFromIndex={highlightFromIndex}
                  expanded={expanded}
                  onToggle={() => toggle(group.title, item.title)}
                />,
                expanded ? (
                  <StackTray key={`tray:${item.title}`} grid={GRID}>
                    {item.members.map((m, i) => (
                      <div
                        key={metricKey(m)}
                        className="tl-fan-out"
                        style={{ animationDelay: `${i * EXPAND_STAGGER_MS}ms` }}
                      >
                        <MetricCard
                          metric={m}
                          count={counts[i] ?? 0}
                          series={series[i]?.values}
                          days={daily?.days}
                          highlightFromIndex={highlightFromIndex}
                          color={series[i]?.color}
                        />
                      </div>
                    ))}
                  </StackTray>
                ) : null,
              ];
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
