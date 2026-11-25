'use client';

// Usage against the limits (subscription.md "Settings, Subscription" and "A team's page in the Explorer"): every
// limit from the contract's rows, grouped as the comparison groups them, each with its app's logo. A limit that is
// counted shows a meter; one that is not shows what the tier allows in words; a feature the tier does not include says
// it is part of Pro. On Free each row also says what the next tier allows: Pro for a person, Pro for Teams for a team.
// One list for Settings' Your Usage and a team page's Usage tab.

import {
  formatTierLimit,
  LIMIT_GROUPS,
  LIMIT_ROWS,
  parseOwnerScope,
  type LimitRow,
  type SubscriptionSummary,
} from '@liveworkspace/subscription';
import { rowAppLine } from '../comparison/ComparisonGrid';
import { ProBadge } from '../ProBadge';
import { useUpgrade } from '../provider/hooks';
import { RowAppLogo } from '../RowAppLogo';
import { rowUsage } from '../usage';
import { UsageMeter } from '../UsageMeter';

const GROUPED = LIMIT_GROUPS.map((group) => ({
  group,
  rows: LIMIT_ROWS.filter((row) => row.group === group),
})).filter(({ rows }) => rows.length > 0);

export function UsageList({
  summary,
  sectionClassName = '',
}: {
  summary: SubscriptionSummary;
  /** Each group's own classes (Settings' card slot). */
  sectionClassName?: string;
}) {
  return (
    <div className="flex flex-col" data-usage-list={summary.owner}>
      {GROUPED.map(({ group, rows }) => (
        <section key={group} aria-label={group} className={`flex flex-col ${sectionClassName}`}>
          <h4 className="px-4 pt-3.5 pb-1 text-xs font-bold tracking-[0.02em] text-slate-900 dark:text-slate-100">
            {group}
          </h4>
          <ul className="flex flex-col">
            {rows.map((row) => (
              <UsageRow key={row.key} row={row} summary={summary} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function UsageRow({ row, summary }: { row: LimitRow; summary: SubscriptionSummary }) {
  const upgrade = useUpgrade();
  const used = rowUsage(row, summary);
  const now = formatTierLimit(row, summary.tier);
  const team = parseOwnerScope(summary.owner)?.kind === 'team';
  const next = team ? 'team' : 'pro';
  const onNext = formatTierLimit(row, next);
  const free = summary.tier === 'free';
  // Not included on this tier (a limit of 0): the way to it is the upgrade.
  const locked = summary.limits[row.key] === 0;
  return (
    <li
      data-usage-row={row.key}
      className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-slate-100 px-4 py-3 first:border-t-0 dark:border-slate-700/70"
    >
      <div className="flex min-w-0 flex-[1_1_14rem] items-center gap-2.5">
        <RowAppLogo apps={row.apps} className="size-5" />
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="text-sm font-medium text-slate-800 dark:text-slate-100">
            {row.label}
          </span>
          <span className="text-xs text-slate-500 dark:text-slate-400">{rowAppLine(row)}</span>
        </div>
      </div>
      {/* The bar and the figures keep their own columns, so every row's bar starts and ends on the same lines. */}
      <div className="flex min-w-0 flex-[1_1_12rem] gap-x-4 gap-y-1.5 max-sm:flex-col-reverse sm:flex-none sm:items-center">
        {!locked && used && used.limit !== null ? (
          <UsageMeter
            limitKey={row.key}
            used={used.used}
            limit={used.limit}
            showLabel={false}
            showWords={false}
            // On a phone the bar runs the row's width under the figures; from `sm` up it is the meter's own width.
            className="max-sm:w-full"
          />
        ) : null}
        <div className="ml-auto flex min-w-0 flex-col items-end gap-0.5 sm:w-48">
          {locked ? (
            <button
              type="button"
              onClick={() => upgrade.openUpgrade({ owner: summary.owner, limit: row.key })}
              className="touch-target relative inline-flex cursor-pointer items-center gap-1.5 rounded text-[13px] font-medium text-slate-700 underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400 dark:text-slate-200"
            >
              Part of Pro
              <ProBadge form="outline" size="sm" decorative />
            </button>
          ) : (
            <span
              data-usage-value=""
              className={`text-right text-[13px] font-medium tabular-nums ${
                used?.state === 'reached'
                  ? 'text-amber-800 dark:text-amber-300'
                  : 'text-slate-700 dark:text-slate-200'
              }`}
            >
              {used ? used.words : now}
            </span>
          )}
          {free && !locked && onNext !== now ? (
            <span className="text-right text-xs text-slate-500 dark:text-slate-400">
              {onNext} on {team ? 'Pro for Teams' : 'Pro'}
            </span>
          ) : null}
        </div>
      </div>
    </li>
  );
}
