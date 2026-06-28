'use client';

import { useMemo, useState } from 'react';
import { EmptyState, Tooltip } from '@livediagram/ui';
import type { TelemetryCount, TelemetrySummary, TelemetryWindowKey } from '@livediagram/api-schema';
import { ActivityGlyph } from './glyphs';
import { pct, fmtDay } from './chart-utils';
import {
  CATEGORY_DESCRIPTIONS,
  categoryColor,
  eventExplanation,
  eventLabel,
  groupByCategory,
  type Group,
} from './event-vocab';
import { EventIcon } from './telemetry-event-icon';

// The Raw view: the full aggregate dashboard (spec/22). The window is the
// global one selected in the timeframe panel above the tabs and arrives
// as a prop; everything here — the category-share bar, the top-N
// leaderboard, and the per-category breakdowns — reflects that window.

// A row of value-proportional bars (one per day) with a per-bar hover tooltip,
// used by the per-category sparkline. Bars never fully vanish (2% floor).
function SparklineBars({
  days,
  values,
  containerClassName,
  barClassName,
}: {
  days: number[];
  values: number[];
  containerClassName: string;
  barClassName: string;
}) {
  const max = Math.max(...values, 1);
  return (
    <div className={containerClassName}>
      {values.map((v, i) => (
        <Tooltip
          key={days[i] ?? i}
          title={fmtDay(days[i] ?? 0)}
          description={`${v.toLocaleString()} events`}
          className="flex-1 items-end self-stretch"
        >
          <div className={barClassName} style={{ height: `${Math.max(2, pct(v, max))}%` }} />
        </Tooltip>
      ))}
    </div>
  );
}

// Category share bar: one stacked horizontal bar broken into segments
// per category, with a legend underneath. Reads at a glance which
// area of the product dominates the active window's activity.
function CategoryShareBar({ groups, total }: { groups: Group[]; total: number }) {
  if (total === 0) return null;
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
      <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
        Share of events by category
      </p>
      <div className="mt-3 flex h-3 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
        {groups.map((g) => (
          <Tooltip
            key={g.category}
            title={g.category}
            description={`${pct(g.subtotal, total).toFixed(1)}% of events`}
            className="h-full"
            style={{ width: `${pct(g.subtotal, total)}%` }}
          >
            <div className="h-full w-full" style={{ backgroundColor: categoryColor(g.category) }} />
          </Tooltip>
        ))}
      </div>
      <ul className="mt-3 flex flex-wrap gap-x-3 gap-y-1.5">
        {groups.map((g) => (
          <li key={g.category} className="flex items-center gap-1.5 text-xs text-slate-600">
            <span
              aria-hidden
              className="inline-block h-2.5 w-2.5 rounded-sm"
              style={{ backgroundColor: categoryColor(g.category) }}
            />
            <span>{g.category}</span>
            <span className="text-slate-400">{pct(g.subtotal, total).toFixed(1)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// Top-N leaderboard: highest-count events across all categories.
// Each row is icon + label + a relative bar + count, sorted desc.
function TopNLeaderboard({ rows, n = 10 }: { rows: TelemetryCount[]; n?: number }) {
  const sorted = [...rows].sort((a, b) => b.count - a.count).slice(0, n);
  if (sorted.length === 0) return null;
  const top = sorted[0]?.count ?? 1;
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
      <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
        Top {sorted.length} events
      </p>
      <ul className="mt-3 flex flex-col gap-2">
        {sorted.map((row) => (
          <Tooltip
            key={`${row.category}:${row.action}:${row.type ?? ''}`}
            title={`${row.category} · ${eventLabel(row)}`}
            description={eventExplanation(row.category, row.action, row.type ?? null)}
            block
          >
            <li className="flex w-full items-center gap-2 text-sm">
              <span className="shrink-0 text-slate-400">
                <EventIcon category={row.category} action={row.action} type={row.type ?? null} />
              </span>
              <span className="w-32 shrink-0 truncate text-slate-600">
                {row.category} · {eventLabel(row)}
              </span>
              <span className="relative h-2 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                <span
                  className="absolute inset-y-0 left-0 rounded-full"
                  style={{
                    width: `${pct(row.count, top)}%`,
                    backgroundColor: categoryColor(row.category),
                  }}
                />
              </span>
              <span className="w-12 shrink-0 text-right font-medium text-slate-900">
                {row.count.toLocaleString()}
              </span>
            </li>
          </Tooltip>
        ))}
      </ul>
    </div>
  );
}

// Per-category sparkline rendered inside each category card so a reader
// can see "is this category trending up?" without scrolling back to the
// timeframe panel's line. 30 bars, scaled to the category's own peak.
function CategorySparkline({ days, series }: { days: number[]; series: number[] }) {
  if (series.length === 0) return null;
  return (
    <SparklineBars
      days={days}
      values={series}
      containerClassName="mt-3 flex h-10 items-end gap-[2px]"
      barClassName="w-full rounded-[1px] bg-slate-200 dark:bg-slate-700"
    />
  );
}

export function RawView({
  summary,
  active,
}: {
  summary: TelemetrySummary;
  active: TelemetryWindowKey;
}) {
  // Category accordions: closed by default so a fresh visitor scans
  // categories first and drills into the one they're curious about.
  // Keyed by category name so the state survives a window switch.
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const toggleCategory = (category: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(category)) next.delete(category);
      else next.add(category);
      return next;
    });

  const window = summary.windows[active];
  const groups = useMemo(() => groupByCategory(window.rows), [window]);

  return (
    <>
      {/* Category-share stacked bar + top-N leaderboard. Side by side on
          wide screens. */}
      {window.total > 0 ? (
        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          <CategoryShareBar groups={groups} total={window.total} />
          <TopNLeaderboard rows={window.rows} />
        </div>
      ) : null}

      {groups.length === 0 ? (
        <div className="mt-8">
          <EmptyState
            icon={<ActivityGlyph />}
            title="No events in this window yet"
            description="Nothing was recorded for the selected timeframe. Try a wider window, or check back once there’s more activity."
          />
        </div>
      ) : (
        // CSS multi-column layout instead of a grid: grid rows would
        // either stretch a collapsed card to match the tallest expanded
        // sibling, or leave a big gap underneath a closed card. Columns
        // flow card-by-card, packing tightly regardless of which
        // accordions are open. `break-inside-avoid` keeps each card whole.
        <div className="mt-8 columns-1 gap-6 sm:columns-2">
          {groups.map((group) => {
            const isOpen = expanded.has(group.category);
            return (
              <div
                key={group.category}
                className="mb-6 break-inside-avoid overflow-hidden rounded-xl border border-slate-200 bg-white"
              >
                <button
                  type="button"
                  onClick={() => toggleCategory(group.category)}
                  aria-expanded={isOpen}
                  className="flex w-full cursor-pointer items-baseline justify-between gap-4 px-5 py-4 text-left transition hover:bg-slate-50"
                >
                  <span className="flex items-baseline gap-2">
                    <span
                      aria-hidden
                      className={
                        'inline-block text-xs text-slate-400 transition-transform ' +
                        (isOpen ? 'rotate-90' : '')
                      }
                    >
                      ▶
                    </span>
                    <h2 className="text-base font-semibold text-slate-900">{group.category}</h2>
                  </span>
                  <span className="text-sm font-medium text-slate-400">
                    {group.subtotal.toLocaleString()}
                  </span>
                </button>
                {/* Grid-template-rows animation so the body slides open/closed
                    rather than popping. Mirrors the MovablePanel pattern. */}
                <div
                  className={
                    'grid transition-[grid-template-rows] duration-200 ease-out ' +
                    (isOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]')
                  }
                >
                  <div className="overflow-hidden">
                    <div className="px-5 pb-5">
                      {CATEGORY_DESCRIPTIONS[group.category] ? (
                        <p className="text-xs leading-relaxed text-slate-500">
                          {CATEGORY_DESCRIPTIONS[group.category]}
                        </p>
                      ) : null}
                      {summary.daily && summary.daily.byCategory[group.category] ? (
                        <CategorySparkline
                          days={summary.daily.days}
                          series={summary.daily.byCategory[group.category]!}
                        />
                      ) : null}
                      <ul className="mt-3 divide-y divide-slate-100">
                        {group.items.map((row) => {
                          const share = group.subtotal > 0 ? row.count / group.subtotal : 0;
                          return (
                            <Tooltip
                              key={`${row.action}:${row.type ?? ''}`}
                              title={eventLabel(row)}
                              description={eventExplanation(
                                row.category,
                                row.action,
                                row.type ?? null,
                              )}
                              block
                            >
                              <li className="block w-full py-1.5 text-sm">
                                <div className="flex items-center justify-between gap-3">
                                  <span className="flex min-w-0 flex-1 items-center gap-2 text-slate-600">
                                    <span className="shrink-0 text-slate-400">
                                      <EventIcon
                                        category={row.category}
                                        action={row.action}
                                        type={row.type ?? null}
                                      />
                                    </span>
                                    <span className="truncate">{eventLabel(row)}</span>
                                  </span>
                                  <span className="font-medium text-slate-900">
                                    {row.count.toLocaleString()}
                                  </span>
                                </div>
                                {/* Inline share bar: row's share of the
                                    category's subtotal. */}
                                <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-slate-100">
                                  <div
                                    className="h-full rounded-full"
                                    style={{
                                      width: `${share * 100}%`,
                                      backgroundColor: categoryColor(group.category),
                                    }}
                                  />
                                </div>
                              </li>
                            </Tooltip>
                          );
                        })}
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
