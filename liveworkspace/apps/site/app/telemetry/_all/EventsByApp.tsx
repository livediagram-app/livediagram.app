'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { CompactEmptyState, Tooltip } from '@liveworkspace/ui';
import {
  TELEMETRY_APPS,
  type TelemetryApp,
  type TelemetrySummary,
  type TelemetryWindowKey,
} from '@liveworkspace/telemetry';
import type { StackSeries } from '../_shared/StackTrendChart';
import { TrendBadge } from '../_shared/TrendBadge';
import { ActivityGlyph } from '../_shared/glyphs';
import { previousSpanLabel, windowHighlightFrom, windowLabel } from '../_shared/windows';
import {
  formatPerVisit,
  formatShare,
  TOTAL,
  type Comparison,
  type ComparedRow,
} from './apps-compared';
import { SeriesChart } from './SeriesChart';
import { Swatch } from '../_shared/chart-hover/Swatch';
import { emphasisProps, useEmphasisStore } from '../_shared/chart-hover/emphasis';
import { CARD, TABLE_CELL, TABLE_HEAD, TOTAL_ROW } from './styles';

// The neutral Total line: dashed, in slate, so it reads as the sum and not as one more app.
const TOTAL_SERIES: Pick<StackSeries, 'className' | 'dashed' | 'total'> = {
  className: 'text-slate-500 dark:text-slate-400',
  dashed: true,
  total: true,
};

// Events by App (liveworkspace/docs/specs/008-telemetry/telemetry.md "Apps Compared"): every app's daily events on
// one chart in its own accent, with the Total, and a table of each app's window against the span before it. A legend
// entry hides or shows its line; hiding the Total lets the apps' lines spread over the whole height.
export function EventsByApp({
  summary,
  comparison,
  active,
  onPickApp,
}: {
  summary: TelemetrySummary;
  comparison: Comparison;
  active: TelemetryWindowKey;
  onPickApp: (app: TelemetryApp) => void;
}) {
  const [hidden, setHidden] = useState<ReadonlySet<string>>(new Set());
  // Hovering or focusing a legend entry emphasises its line in the chart (telemetry.md "Tooltips").
  const emphasis = useEmphasisStore();
  const toggle = (key: string) =>
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const daily = summary.daily;
  const series = useMemo<(StackSeries & { key: string })[]>(() => {
    if (!daily) return [];
    return [
      ...TELEMETRY_APPS.map((app) => ({
        key: app as string,
        label: app,
        app,
        color: 'var(--color-brand-500)',
        values: daily.byApp?.[app] ?? daily.days.map(() => 0),
      })),
      { key: TOTAL, label: 'Total', color: 'currentColor', values: daily.totals, ...TOTAL_SERIES },
    ];
  }, [daily]);
  const shown = series.filter((s) => !hidden.has(s.key));
  const against = previousSpanLabel(summary, active);
  const empty = comparison.total.events === 0 && comparison.total.eventsBefore === 0;

  return (
    <div className={`${CARD} mt-4 p-5`}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
          Events by App, Last 30 Days (UTC)
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400">{windowLabel(active)} shaded</p>
      </div>

      {empty || !daily ? (
        <CompactEmptyState
          icon={<ActivityGlyph />}
          title="No Events Yet"
          description="Nothing has arrived from any app in the last 30 days."
          className="mt-4"
        />
      ) : (
        <>
          <div role="group" aria-label="Lines" className="mt-3 flex flex-wrap gap-1.5">
            {series.map((s) => (
              <Tooltip key={s.key} label={hidden.has(s.key) ? 'Show Line' : 'Hide Line'}>
                <button
                  type="button"
                  aria-pressed={!hidden.has(s.key)}
                  onClick={() => toggle(s.key)}
                  {...emphasisProps(emphasis, s.key)}
                  className={
                    'relative flex min-h-8 cursor-pointer items-center gap-1.5 rounded-full border px-2.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ' +
                    (hidden.has(s.key)
                      ? 'border-slate-200 text-slate-400 line-through dark:border-slate-700 dark:text-slate-500'
                      : 'border-slate-200 text-slate-700 hover:border-slate-300 dark:border-slate-700 dark:text-slate-200 dark:hover:border-slate-600')
                  }
                >
                  <Swatch series={s} />
                  {s.label}
                </button>
              </Tooltip>
            ))}
          </div>
          <div className="mt-4">
            <SeriesChart
              caption="Events per day by app, last 30 days (UTC)"
              days={daily.days}
              series={shown}
              highlightFromIndex={windowHighlightFrom(daily, active)}
              emphasis={emphasis}
            />
          </div>
        </>
      )}

      <div className="mt-5 overflow-x-auto">
        <table className="w-full min-w-[32rem] text-sm">
          <caption className="sr-only">
            Events each app sent in the {windowLabel(active).toLowerCase()}
          </caption>
          <thead>
            <tr>
              <th scope="col" className={`${TABLE_HEAD} text-left`}>
                App
              </th>
              <th scope="col" className={TABLE_HEAD}>
                Events
              </th>
              <th scope="col" className={TABLE_HEAD}>
                Share
              </th>
              <th scope="col" className={TABLE_HEAD}>
                Change
              </th>
              <th scope="col" className={TABLE_HEAD}>
                Events per Visit
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {comparison.apps.map((r) => (
              <EventsRow
                key={r.key}
                row={r}
                against={against}
                name={
                  <Tooltip label="Open Its Dashboard">
                    <button
                      type="button"
                      data-app={r.key}
                      onClick={() => onPickApp(r.key as TelemetryApp)}
                      aria-label={`Open ${r.key}'s dashboard`}
                      className="relative flex cursor-pointer items-center gap-2 rounded font-medium text-brand-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:text-brand-300"
                    >
                      <span aria-hidden className="h-2 w-2 shrink-0 rounded-full bg-brand-500" />
                      {r.key}
                    </button>
                  </Tooltip>
                }
              />
            ))}
            {comparison.platform ? (
              <EventsRow
                row={comparison.platform}
                against={against}
                name={
                  <Tooltip label="The Explorer and Settings on liveworkspace.app, for no one app">
                    <span className="text-slate-600 dark:text-slate-300">liveworkspace.app</span>
                  </Tooltip>
                }
              />
            ) : null}
          </tbody>
          <tfoot>
            <EventsRow row={comparison.total} against={against} name="Total" total />
          </tfoot>
        </table>
      </div>
    </div>
  );
}

function EventsRow({
  row,
  name,
  against,
  total = false,
}: {
  row: ComparedRow;
  name: ReactNode;
  against: string | null;
  total?: boolean;
}) {
  return (
    <tr className={total ? TOTAL_ROW : undefined}>
      <th scope="row" className={`${TABLE_CELL} text-left font-normal`}>
        {name}
      </th>
      <td className={TABLE_CELL}>{row.events.toLocaleString('en-GB')}</td>
      <td className={TABLE_CELL}>{formatShare(row.share)}</td>
      <td className={TABLE_CELL}>
        {against ? (
          <span className="inline-flex justify-end">
            <TrendBadge
              now={row.events}
              before={row.eventsBefore}
              rising="good"
              against={against}
            />
          </span>
        ) : (
          '–'
        )}
      </td>
      <td className={TABLE_CELL}>
        {row.key === 'liveworkspace.app' ? '–' : formatPerVisit(row.eventsPerVisit)}
      </td>
    </tr>
  );
}
