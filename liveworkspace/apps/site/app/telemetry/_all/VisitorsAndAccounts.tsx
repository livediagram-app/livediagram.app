'use client';

import { useMemo, useState } from 'react';
import { CompactEmptyState } from '@liveworkspace/ui';
import {
  TELEMETRY_APPS,
  type TelemetrySummary,
  type TelemetryWindowKey,
} from '@liveworkspace/telemetry';
import type { Rising } from '../_shared/metric-series';
import type { StackSeries } from '../_shared/StackTrendChart';
import { TrendBadge } from '../_shared/TrendBadge';
import { ActivityGlyph } from '../_shared/glyphs';
import { previousSpanLabel, windowHighlightFrom, windowLabel } from '../_shared/windows';
import {
  addSeries,
  audienceSeries,
  formatAverage,
  formatPer100,
  formatShare,
  hasAudience,
  ratio,
  scopeRow,
  TOTAL,
  type AudienceScope,
  type ComparedRow,
  type Comparison,
} from './apps-compared';
import { SeriesChart } from './SeriesChart';
import { Swatch } from '../_shared/chart-hover/Swatch';
import { emphasisProps, useEmphasisStore } from '../_shared/chart-hover/emphasis';
import { CARD, TABLE_CELL, TABLE_HEAD, TOTAL_ROW } from './styles';

// The second line of each chart: neutral slate, dashed, so the two read apart by shape as well as colour.
const SECOND: Pick<StackSeries, 'className' | 'dashed'> = {
  className: 'text-slate-500 dark:text-slate-400',
  dashed: true,
};

// Visitors and Accounts (liveworkspace/docs/specs/008-telemetry/telemetry.md "Apps Compared"): new and returning
// visitors, sign-ups and sign-ins for every app added up or one app, as tiles against the span before, two daily
// charts, and a table that compares the apps side by side whatever the scope.
export function VisitorsAndAccounts({
  summary,
  comparison,
  active,
}: {
  summary: TelemetrySummary;
  comparison: Comparison;
  active: TelemetryWindowKey;
}) {
  const [scope, setScope] = useState<AudienceScope>(TOTAL);
  const daily = summary.daily;
  const row = scopeRow(comparison, scope);
  const against = previousSpanLabel(summary, active);
  const highlight = daily ? windowHighlightFrom(daily, active) : 0;
  // Nothing to scope or chart until an audience event has arrived.
  const counted = daily !== undefined && hasAudience(summary);

  const charts = useMemo(() => {
    const at = (key: Parameters<typeof audienceSeries>[2]) => audienceSeries(summary, scope, key);
    return {
      newVisitors: at('newVisitors'),
      returning: addSeries(at('returningGuests'), at('returningSignedIn')),
      signUps: at('signUps'),
      signIns: at('signIns'),
    };
  }, [summary, scope]);
  // The scope's accent: an app's own, or the dashboard's for every app.
  const accent = scope === TOTAL ? undefined : scope;

  return (
    <div className={`${CARD} mt-4 p-5`} data-app={accent}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
          Visitors and Accounts
        </h3>
        {counted ? <ScopePicker value={scope} onChange={setScope} /> : null}
      </div>

      {!counted || !daily ? (
        <CompactEmptyState
          icon={<ActivityGlyph />}
          title="No Visitors Yet"
          description="No new or returning visitor, sign-up or sign-in has been counted in the last 30 days."
          className="mt-4"
        />
      ) : (
        <>
          <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <Tile
              label="Avg Daily Visitors"
              value={formatAverage(row.avgDailyVisitors)}
              now={row.avgDailyVisitors}
              before={row.avgDailyVisitorsBefore}
              against={against}
            />
            <Tile
              label="New Visitors"
              value={row.now.newVisitors.toLocaleString('en-GB')}
              now={row.now.newVisitors}
              before={row.before.newVisitors}
              against={against}
            />
            <Tile
              label="Returning Share"
              value={formatShare(row.returningShare)}
              detail={`${row.now.returning.toLocaleString('en-GB')} returning visits`}
            />
            <Tile
              label="Sign-Ups"
              value={row.now.signUps.toLocaleString('en-GB')}
              now={row.now.signUps}
              before={row.before.signUps}
              against={against}
            />
            <Tile
              label="Sign-Ins"
              value={row.now.signIns.toLocaleString('en-GB')}
              now={row.now.signIns}
              before={row.before.signIns}
              against={against}
            />
            <Tile
              label="Sign-Ups per 100 New"
              value={
                row.signUpsPerNewVisitor === null
                  ? '–'
                  : formatAverage(row.signUpsPerNewVisitor * 100)
              }
              now={Math.round((row.signUpsPerNewVisitor ?? 0) * 1000) / 10}
              before={
                Math.round((ratio(row.before.signUps, row.before.newVisitors) ?? 0) * 1000) / 10
              }
              against={
                against && row.signUpsPerNewVisitor !== null && row.before.newVisitors > 0
                  ? against
                  : null
              }
            />
          </dl>

          <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
            <ChartBlock
              title="New and Returning Visitors per Day"
              caption="New and returning visitors per day, last 30 days (UTC)"
              days={daily.days}
              highlight={highlight}
              totalLabel="Visits"
              series={[
                { label: 'New', color: 'var(--color-brand-500)', values: charts.newVisitors },
                { label: 'Returning', color: 'currentColor', values: charts.returning, ...SECOND },
              ]}
            />
            <ChartBlock
              title="Sign-Ups and Sign-Ins per Day"
              caption="Sign-ups and sign-ins per day, last 30 days (UTC)"
              days={daily.days}
              highlight={highlight}
              series={[
                { label: 'Sign-Ups', color: 'var(--color-brand-500)', values: charts.signUps },
                { label: 'Sign-Ins', color: 'currentColor', values: charts.signIns, ...SECOND },
              ]}
            />
          </div>

          <AudienceTable comparison={comparison} active={active} />
        </>
      )}

      <details className="mt-5 text-xs text-slate-500 dark:text-slate-400">
        <summary className="relative cursor-pointer font-medium text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-slate-100">
          What These Count
        </summary>
        <ul className="mt-2 list-disc space-y-1 pl-5 leading-relaxed">
          <li>
            A new visitor is a browser opening the app for the first time. A returning visitor is a
            browser that has been before, opening it on a later UTC day, counted once that day, as a
            guest or signed in.
          </li>
          <li>
            A visit is one browser on one day, so a day’s visits are the browsers that opened the
            app. Over 7 or 30 days the same browser counts once each day, which is why there are no
            weekly or monthly unique visitors: telling two days’ visits apart would need an id per
            person, and these events carry none.
          </li>
          <li>
            A sign-up is an account this app has never seen finishing sign-in (an account made on
            another app counts as new here). A sign-in is any other finished sign-in, never a token
            refresh. The Total adds the apps, so one person joining two apps is two sign-ups.
          </li>
          <li>
            A browser that has turned telemetry off, or asks sites not to track, sends no visits;
            sign-ups and sign-ins are counted by the apps’ servers, so they still count. Clearing a
            browser’s storage makes it new again.
          </li>
        </ul>
      </details>
    </div>
  );
}

// Every app added up, or one app: the scope of the tiles and charts. The table always shows every app.
function ScopePicker({
  value,
  onChange,
}: {
  value: AudienceScope;
  onChange: (next: AudienceScope) => void;
}) {
  const choices: { key: AudienceScope; label: string }[] = [
    { key: TOTAL, label: 'All Apps' },
    ...TELEMETRY_APPS.map((app) => ({ key: app, label: app })),
  ];
  return (
    <div
      role="radiogroup"
      aria-label="Visitors and accounts for"
      className="flex max-w-full flex-wrap gap-1 rounded-lg border border-slate-200 bg-slate-50 p-0.5 dark:border-slate-700 dark:bg-slate-800"
    >
      {choices.map((c) => (
        <button
          key={c.key}
          type="button"
          role="radio"
          aria-checked={value === c.key}
          onClick={() => onChange(c.key)}
          data-app={c.key === TOTAL ? undefined : c.key}
          className={
            'relative flex min-h-8 cursor-pointer items-center gap-1.5 rounded-md px-2.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ' +
            (value === c.key
              ? 'bg-white text-brand-700 shadow-sm dark:bg-slate-700 dark:text-brand-200'
              : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100')
          }
        >
          {c.key === TOTAL ? null : (
            <span aria-hidden className="h-1.5 w-1.5 shrink-0 rounded-full bg-brand-500" />
          )}
          {c.label}
        </button>
      ))}
    </div>
  );
}

// One figure for the scope and window, with its arrow against the span before when there is one.
function Tile({
  label,
  value,
  now,
  before,
  against = null,
  detail,
  rising = 'good',
}: {
  label: string;
  value: string;
  now?: number;
  before?: number;
  against?: string | null;
  detail?: string;
  rising?: Rising;
}) {
  return (
    <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
      <dt className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {label}
      </dt>
      <dd className="mt-1 flex flex-wrap items-center gap-2">
        <span className="text-xl font-semibold tabular-nums text-slate-900 dark:text-slate-100">
          {value}
        </span>
        {against && now !== undefined && before !== undefined ? (
          <TrendBadge now={now} before={before} rising={rising} against={against} />
        ) : null}
      </dd>
      {detail ? (
        <dd className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{detail}</dd>
      ) : null}
    </div>
  );
}

function ChartBlock({
  title,
  caption,
  days,
  highlight,
  series,
  totalLabel,
}: {
  title: string;
  caption: string;
  days: number[];
  highlight: number;
  series: StackSeries[];
  totalLabel?: string;
}) {
  const emphasis = useEmphasisStore();
  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h4 className="text-xs font-semibold text-slate-700 dark:text-slate-200">{title}</h4>
        <ul className="flex gap-3 text-[11px] text-slate-500 dark:text-slate-400">
          {series.map((s) => (
            <li
              key={s.label}
              className="flex items-center gap-1.5"
              {...emphasisProps(emphasis, s.label)}
            >
              <Swatch series={s} />
              {s.label}
            </li>
          ))}
        </ul>
      </div>
      <div className="mt-3">
        <SeriesChart
          caption={caption}
          days={days}
          series={series}
          highlightFromIndex={highlight}
          heightClassName="h-32"
          totalLabel={totalLabel}
          emphasis={emphasis}
        />
      </div>
    </div>
  );
}

// Every app side by side in the window, and the Total, whatever the scope above.
function AudienceTable({
  comparison,
  active,
}: {
  comparison: Comparison;
  active: TelemetryWindowKey;
}) {
  const heads = [
    'Avg Daily Visitors',
    'New',
    'Returning',
    'Returning Share',
    'Signed In of Returning',
    'Sign-Ups',
    'Sign-Ins',
    'Sign-Ups per New',
  ];
  return (
    <div className="mt-6 overflow-x-auto">
      <table className="w-full min-w-[44rem] text-sm">
        <caption className="sr-only">
          Visitors and accounts by app in the {windowLabel(active).toLowerCase()}
        </caption>
        <thead>
          <tr>
            <th scope="col" className={`${TABLE_HEAD} text-left`}>
              App
            </th>
            {heads.map((h) => (
              <th key={h} scope="col" className={TABLE_HEAD}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
          {comparison.apps.map((r) => (
            <AudienceRow key={r.key} row={r} />
          ))}
        </tbody>
        <tfoot>
          <AudienceRow row={comparison.total} total />
        </tfoot>
      </table>
    </div>
  );
}

function AudienceRow({ row, total = false }: { row: ComparedRow; total?: boolean }) {
  const n = row.now;
  return (
    <tr className={total ? TOTAL_ROW : undefined}>
      <th scope="row" className={`${TABLE_CELL} text-left font-normal`}>
        {total ? (
          'Total'
        ) : (
          <span data-app={row.key} className="flex items-center gap-2">
            <span aria-hidden className="h-2 w-2 shrink-0 rounded-full bg-brand-500" />
            {row.key}
          </span>
        )}
      </th>
      <td className={TABLE_CELL}>{formatAverage(row.avgDailyVisitors)}</td>
      <td className={TABLE_CELL}>{n.newVisitors.toLocaleString('en-GB')}</td>
      <td className={TABLE_CELL}>{n.returning.toLocaleString('en-GB')}</td>
      <td className={TABLE_CELL}>{formatShare(row.returningShare)}</td>
      <td className={TABLE_CELL}>{formatShare(row.signedInShare)}</td>
      <td className={TABLE_CELL}>{n.signUps.toLocaleString('en-GB')}</td>
      <td className={TABLE_CELL}>{n.signIns.toLocaleString('en-GB')}</td>
      <td className={TABLE_CELL}>{formatPer100(row.signUpsPerNewVisitor)}</td>
    </tr>
  );
}
