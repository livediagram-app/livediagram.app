'use client';

import { Fragment, useState } from 'react';
import type { TelemetrySummary, TelemetryWindowKey } from '@livediagram/api-schema';
import { MetricCard } from './MetricCard';
import { MetricStackCard } from './MetricStackCard';
import { StackModal } from './StackModal';
import {
  dailySeries,
  isStack,
  metricKey,
  stackDrawsLines,
  stackSeriesColor,
  previousCount,
  windowCount,
  type Metric,
} from './metric-series';
import type { ViewKey } from './view-keys';
import { previousSpanLabel, windowDays, windowHighlightFrom } from './windows';

export type { Metric, MetricGroup, MetricStack } from './metric-series';
import type { MetricGroup } from './metric-series';

// Curated metrics rendered as cards: the selected-window count + a 30-day
// trend line each (MetricCard), or a chart stack (MetricStackCard) whose
// members open in a modal over the page (StackModal). Shared by every
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
  onOpenView,
}: {
  groups: MetricGroup[];
  summary: TelemetrySummary;
  active: TelemetryWindowKey;
  // Follows a stack's See also link. Views that host no linking stack omit it.
  onOpenView?: (view: ViewKey) => void;
}) {
  const daily = summary.daily;
  const highlightFromIndex = daily ? windowHighlightFrom(daily, active) : null;
  // Trend arrows compare each count with the same span just before the window.
  const against = previousSpanLabel(summary, active);
  const span = windowDays(active);
  const previousOf = (m: Metric) => (against ? previousCount(summary, active, m, span) : null);
  // The one open stack, and its head card (focus returns there on close). Opening
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
                    previous={previousOf(item)}
                    against={against}
                  />
                );
              }
              const key = `${group.title}|${item.title}`;
              const opened = open?.key === key ? open : null;
              const counts = item.members.map((m) => windowCount(summary, active, m));
              const lines = stackDrawsLines(item.members.length);
              const series = item.members.map((m, i) => ({
                label: m.title,
                color: stackSeriesColor(i),
                values: daily ? dailySeries(daily, m) : [],
              }));
              // The modal is portalled to <body>, so rendering it beside
              // the head adds nothing to the grid.
              return (
                <Fragment key={`stack:${item.title}`}>
                  <MetricStackCard
                    stack={item}
                    series={series}
                    counts={counts}
                    days={daily?.days}
                    highlightFromIndex={highlightFromIndex}
                    previousCounts={item.members.map(previousOf)}
                    against={against}
                    expanded={opened !== null}
                    onToggle={(anchor) => setOpen(opened ? null : { key, anchor })}
                  />
                  {opened ? (
                    <StackModal
                      anchor={opened.anchor}
                      title={item.title}
                      subtitle={`${item.members.length} charts`}
                      count={item.members.length}
                      onClose={close}
                      footer={
                        item.seeAlso && onOpenView ? (
                          <SeeAlsoLink
                            label={item.seeAlso.label}
                            onClick={() => {
                              const view = item.seeAlso!.view;
                              close();
                              onOpenView(view);
                            }}
                          />
                        ) : undefined
                      }
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
                            previous={previousOf(m)}
                            against={against}
                            color={lines ? series[i]?.color : undefined}
                          />
                        </div>
                      ))}
                    </StackModal>
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

// The full-width link at the foot of a stack's modal into a tab that goes
// deeper (spec/22 See also).
function SeeAlsoLink({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-sky-600 transition-colors hover:border-sky-300 hover:bg-sky-50 dark:border-slate-700 dark:bg-slate-900 dark:text-sky-400 dark:hover:border-sky-700 dark:hover:bg-sky-950"
    >
      {label}
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" aria-hidden>
        <path
          d="M5 12h14M13 6l6 6-6 6"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}
