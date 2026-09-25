'use client';

import { useState } from 'react';
import type { TelemetrySummary, TelemetryWindowKey } from '@livediagram/api-schema';
import { MetricCard } from './MetricCard';
import { MetricStackCard } from './MetricStackCard';
import {
  dailySeries,
  isStack,
  metricKey,
  stackSeriesColor,
  windowCount,
  type MetricStack,
} from './metric-series';
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

const stackKey = (group: MetricGroup, stack: MetricStack) => `${group.title}|${stack.title}`;

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
  // Which stacks are fanned out. View state only: nothing persists it.
  const [open, setOpen] = useState<ReadonlySet<string>>(new Set());
  const toggle = (key: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (!next.delete(key)) next.add(key);
      return next;
    });

  return (
    <div className="mt-6 flex flex-col gap-8">
      {groups.map((group) => (
        <section key={group.title}>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            {group.title}
          </h3>
          <div className="mt-3 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
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
              const key = stackKey(group, item);
              const expanded = open.has(key);
              const counts = item.members.map((m) => windowCount(summary, active, m));
              const series = item.members.map((m, i) => ({
                label: m.title,
                color: stackSeriesColor(i),
                values: daily ? dailySeries(daily, m) : [],
              }));
              // A fragment, so the head and its fanned-out members are each
              // their own grid cell rather than one oversized item.
              return [
                <MetricStackCard
                  key={`stack:${key}`}
                  stack={item}
                  series={series}
                  counts={counts}
                  days={daily?.days}
                  highlightFromIndex={highlightFromIndex}
                  expanded={expanded}
                  onToggle={() => toggle(key)}
                />,
                ...(expanded
                  ? item.members.map((m, i) => (
                      <div
                        key={`stack:${key}:${metricKey(m)}`}
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
                    ))
                  : []),
              ];
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
