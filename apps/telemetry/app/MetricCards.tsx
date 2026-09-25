'use client';

import { Fragment, useState } from 'react';
import type { TelemetrySummary, TelemetryWindowKey } from '@livediagram/api-schema';
import { MetricCard } from './MetricCard';
import { MetricStackCard } from './MetricStackCard';
import { StackPopover } from './StackPopover';
import {
  dailySeries,
  isStack,
  metricKey,
  stackDrawsLines,
  stackSeriesColor,
  windowCount,
} from './metric-series';
import { windowHighlightFrom } from './windows';

export type { Metric, MetricGroup, MetricStack } from './metric-series';
import type { MetricGroup } from './metric-series';

// Curated metrics rendered as cards: the selected-window count + a 30-day
// trend line each (MetricCard), or a chart stack (MetricStackCard) whose
// members open in a popover over the page (StackPopover). Shared by every
// metric-card view so each is just a list of metric groups rendered
// identically.

// Slower than a page cascade: an expansion is a deliberate act on a handful
// of cards, so the fan is worth seeing (the Timeline's rate, spec/138 §2.6).
const EXPAND_STAGGER_MS = 60;

const GRID = 'grid gap-4 sm:grid-cols-2 xl:grid-cols-3';

type OpenStack = { key: string; anchor: HTMLElement };

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
  // The one open stack and the head card its popover anchors to. Opening
  // another stack replaces it. View state only: nothing persists it.
  const [open, setOpen] = useState<OpenStack | null>(null);
  const close = () => setOpen(null);

  return (
    <div className="mt-6 flex flex-col gap-8">
      {groups.map((group) => (
        <section key={group.title}>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            {group.title}
          </h3>
          <div className={`mt-3 ${GRID}`}>
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
              const key = `${group.title}|${item.title}`;
              const popover = open?.key === key ? open : null;
              const counts = item.members.map((m) => windowCount(summary, active, m));
              const lines = stackDrawsLines(item.members.length);
              const series = item.members.map((m, i) => ({
                label: m.title,
                color: stackSeriesColor(i),
                values: daily ? dailySeries(daily, m) : [],
              }));
              // The popover is portalled to <body>, so rendering it beside
              // the head adds nothing to the grid.
              return (
                <Fragment key={`stack:${item.title}`}>
                  <MetricStackCard
                    stack={item}
                    series={series}
                    counts={counts}
                    days={daily?.days}
                    highlightFromIndex={highlightFromIndex}
                    expanded={popover !== null}
                    onToggle={(anchor) => setOpen(popover ? null : { key, anchor })}
                  />
                  {popover ? (
                    <StackPopover
                      anchor={popover.anchor}
                      title={item.title}
                      subtitle={`${item.members.length} charts`}
                      count={item.members.length}
                      onClose={close}
                    >
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
                            color={lines ? series[i]?.color : undefined}
                          />
                        </div>
                      ))}
                    </StackPopover>
                  ) : null}
                </Fragment>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
