'use client';

import { useState } from 'react';
import {
  formatTierLimit,
  LIMIT_GROUPS,
  LIMIT_ROWS,
  TIER_NAMES,
  TIERS,
  type LimitKey,
  type LimitRow,
  type SubscriptionSummary,
  type Tier,
} from '@liveworkspace/subscription';
import { SegmentedToggle, useMediaQuery, type SegmentedOption } from '@liveworkspace/ui';
import { RowAppLogo, rowAppName } from '../RowAppLogo';
import { rowUsage, type RowUsage } from '../usage';
import { InfoPopover } from './InfoPopover';

export type ComparisonGridProps = {
  /** The table's accessible name: "What each tier allows". */
  label: string;
  /** Whose usage the "now" column shows: the person's own or a team's summary. Null leaves the column out (a
   *  visitor who is not signed in); `loading` keeps its place while the service answers. */
  usage: Pick<SubscriptionSummary, 'limits' | 'usage'> | 'loading' | null;
  /** The usage column's heading: "Your Usage Now", "Team Usage Now". */
  usageHeading?: string;
  /** Whether this person has their own AI key set, for Bring Your Own AI's usage cell (Configured or Not
   *  Configured); `loading` while it is read, null or absent to leave the cell quiet. */
  ownAiKey?: boolean | 'loading' | null;
  /** The tier being offered: its column is tinted and its figures are bold. */
  highlight?: Exclude<Tier, 'free'> | null;
  /** The limit the comparison was opened from: its usage reads in amber whatever its count. */
  focus?: LimitKey | null;
  /** `phone` and `wide` fix the layout; `auto` (the default) is the phone's below 768px. */
  layout?: 'auto' | 'phone' | 'wide';
  /** Keep the heading row (What You Get and the tiers) at the top of the scrolling box it sits in: a dialog's body,
   *  which then scrolls sideways too, as Subscribe For stays above it. Set the box's own background in `stickyBg`. */
  stickyHead?: boolean;
  /** The heading row's ground while it is stuck, the box's own: `bg-white dark:bg-slate-900` in a dialog. */
  stickyBg?: string;
  className?: string;
};

// The comparison's phone layout: one tier's column at a time, chosen with a switch.
export const COMPARISON_PHONE_QUERY = '(max-width: 767.98px)';

// Each row is its own grid on the same tracks, so the columns line up without a table's markup.
const TRACKS = {
  // Free's column holds its longest figure on one line.
  full: 'grid-cols-[minmax(0,1fr)_170px_150px_130px_150px]',
  // Without the usage column the tiers share the room it leaves, so they do not huddle at the right edge.
  noUsage: 'grid-cols-[minmax(0,1.5fr)_minmax(140px,1fr)_minmax(130px,1fr)_minmax(150px,1fr)]',
  // Wide enough for the longest figure ("50,000 a month") and heading ("Pro for Teams") on one line.
  phone: 'grid-cols-[minmax(0,1fr)_8.5rem]',
} as const;

const HEAD =
  'text-[11px] font-semibold tracking-[0.06em] uppercase text-slate-500 dark:text-slate-400';
// Dark enough to read on the pricing page's off-white ground as well as on a dialog's white.
const TINT = 'bg-slate-200/50 dark:bg-slate-800/60';

const TIER_OPTIONS: readonly SegmentedOption<Tier>[] = TIERS.map((tier) => ({
  value: tier,
  label: TIER_NAMES[tier],
  description: `Show what ${TIER_NAMES[tier]} allows`,
}));

const groupedRows = LIMIT_GROUPS.map((group) => ({
  group,
  rows: LIMIT_ROWS.filter((row) => row.group === group && row.compared !== false),
})).filter(({ rows }) => rows.length > 0);

/** Where a row applies, under its name: "liveknowledge", "Every app". Every limit is the owner's, across all their
 *  items. */
export function rowAppLine(row: LimitRow): string {
  return rowAppName(row.apps);
}

/**
 * Every limit by tier, grouped, beside what the owner uses now (subscription.md "What people see": the upgrade
 * dialog and the pricing page draw the same comparison). All of it comes from the contract's rows: the labels, the
 * groups, each tier's figure and each explanation.
 *
 * A grid with a table's roles, so a screen reader reads rows and columns. On a phone it shows one tier at a time,
 * chosen with the switch above it, and each row's usage moves under its name.
 */
export function ComparisonGrid({
  label,
  usage,
  usageHeading = 'Your Usage Now',
  ownAiKey = null,
  highlight = null,
  focus = null,
  layout = 'auto',
  stickyHead = false,
  stickyBg = 'bg-white dark:bg-slate-900',
  className,
}: ComparisonGridProps) {
  const narrow = useMediaQuery(COMPARISON_PHONE_QUERY);
  const phone = layout === 'phone' || (layout === 'auto' && narrow);
  // The phone's one column: the tier on offer until the reader picks another.
  const [picked, setPicked] = useState<Tier | null>(null);
  const shown: Tier = picked ?? highlight ?? 'pro';
  const tiers: readonly Tier[] = phone ? [shown] : TIERS;
  const withUsage = usage !== null && !phone;
  const tracks = phone ? TRACKS.phone : withUsage ? TRACKS.full : TRACKS.noUsage;
  const columns = 1 + (withUsage ? 1 : 0) + tiers.length;
  const row = `grid ${tracks} items-stretch`;

  return (
    <div className={className}>
      {phone ? (
        <div className="flex items-center justify-between gap-3 px-2 pb-3">
          <span aria-hidden className="text-xs font-medium text-slate-600 dark:text-slate-300">
            Show
          </span>
          <SegmentedToggle label="Show" value={shown} onChange={setPicked} options={TIER_OPTIONS} />
        </div>
      ) : null}
      {/* A box that scrolls sideways is the one a sticky row sticks in, so with stickyHead the grid leaves its
          sideways scroll to the box around it. */}
      <div className={phone || stickyHead ? undefined : 'overflow-x-auto'}>
        <div
          role="table"
          aria-label={label}
          className={`flex flex-col${phone ? '' : withUsage ? ' min-w-[820px]' : ' min-w-[660px]'}`}
        >
          <div role="rowgroup" className={stickyHead ? `sticky top-0 z-10 ${stickyBg}` : undefined}>
            <div role="row" className={`${row} ${HEAD}`}>
              <span role="columnheader" className="px-2 pt-3.5 pb-2.5">
                What You Get
              </span>
              {withUsage ? (
                <span role="columnheader" className="px-2 pt-3.5 pb-2.5">
                  {usageHeading}
                </span>
              ) : null}
              {tiers.map((tier) => (
                <span
                  key={tier}
                  role="columnheader"
                  className={
                    tier === 'free'
                      ? 'px-2 pt-3.5 pb-2.5'
                      : `rounded-t-[10px] px-3 pt-3.5 pb-2.5 font-bold ${
                          !phone && tier === highlight
                            ? `${TINT} text-slate-900 dark:text-white`
                            : ''
                        }`
                  }
                >
                  {TIER_NAMES[tier]}
                </span>
              ))}
            </div>
          </div>
          {groupedRows.map(({ group, rows }) => (
            <div key={group} role="rowgroup">
              <div role="row" className={`${row} border-t border-slate-200 dark:border-slate-700`}>
                <span
                  role="columnheader"
                  aria-colspan={columns}
                  className="px-2 pt-4.5 pb-2 text-xs font-bold tracking-[0.02em] text-slate-900 dark:text-slate-100"
                >
                  {group}
                </span>
                {/* The tinted column runs unbroken through the group's heading. */}
                {withUsage ? <span aria-hidden /> : null}
                {tiers.map((tier) => (
                  <span
                    key={tier}
                    aria-hidden
                    className={!phone && tier !== 'free' && tier === highlight ? TINT : undefined}
                  />
                ))}
              </div>
              {rows.map((limit) => (
                <ComparisonRow
                  key={limit.key}
                  limit={limit}
                  rowClass={row}
                  tiers={tiers}
                  highlight={phone ? null : highlight}
                  used={
                    limit.key === 'ownAiKey' && usage !== null
                      ? ownKeyUsage(ownAiKey)
                      : usage === 'loading'
                        ? 'loading'
                        : usage
                          ? rowUsage(limit, usage)
                          : null
                  }
                  usageColumn={withUsage}
                  usageUnder={phone && usage !== null}
                  focused={focus === limit.key}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ComparisonRow({
  limit,
  rowClass,
  tiers,
  highlight,
  used,
  usageColumn,
  usageUnder,
  focused,
}: {
  limit: LimitRow;
  rowClass: string;
  tiers: readonly Tier[];
  highlight: Tier | null;
  used: RowUsage | 'loading' | null;
  usageColumn: boolean;
  usageUnder: boolean;
  focused: boolean;
}) {
  return (
    <div
      role="row"
      data-limit-row={limit.key}
      className={`${rowClass} border-t border-slate-100 text-[13px] dark:border-slate-800`}
    >
      <div role="rowheader" className="flex min-w-0 items-center gap-2.5 px-2 py-2.5">
        <RowAppLogo apps={limit.apps} />
        <div className="flex min-w-0 flex-col gap-px">
          <div className="flex min-w-0 items-center gap-1">
            <span className="min-w-0 text-sm font-medium text-slate-800 dark:text-slate-100">
              {limit.label}
            </span>
            <InfoPopover label={`What ${limit.label} Means`}>{limit.info}</InfoPopover>
          </div>
          <span className="text-xs text-slate-500 dark:text-slate-400">{rowAppLine(limit)}</span>
          {usageUnder ? <UsageNow used={used} focused={focused} className="pt-1.5" /> : null}
        </div>
      </div>
      {usageColumn ? (
        <div role="cell" className="flex flex-col justify-center px-2 py-2.5">
          <UsageNow used={used} focused={focused} />
        </div>
      ) : null}
      {tiers.map((tier) => {
        const on = tier !== 'free' && tier === highlight;
        return (
          <span
            key={tier}
            role="cell"
            className={`flex items-center py-2.5 tabular-nums ${tier === 'free' ? 'px-2' : 'px-3'} ${
              on
                ? `${TINT} font-semibold text-slate-900 dark:text-white`
                : 'text-slate-600 dark:text-slate-300'
            }`}
          >
            {formatTierLimit(limit, tier)}
          </span>
        );
      })}
    </div>
  );
}

/** Bring Your Own AI's cell: whether this person's own key is set. It is never counted, so there is no bar. */
function ownKeyUsage(key: boolean | 'loading' | null): RowUsage | 'loading' | null {
  if (key === 'loading') return 'loading';
  if (key === null) return null;
  return {
    used: 0,
    limit: null,
    words: key ? 'Configured' : 'Not Configured',
    fraction: 0,
    state: 'unlimited',
  };
}

/** What the owner uses of one row now: the words over a thin bar, amber at the limit; quiet where nothing is counted. */
function UsageNow({
  used,
  focused,
  className,
}: {
  used: RowUsage | 'loading' | null;
  focused: boolean;
  className?: string;
}) {
  if (used === 'loading')
    return (
      <span
        aria-hidden
        className={`block h-[5px] w-[120px] max-w-full animate-pulse rounded-full bg-slate-100 motion-reduce:animate-none dark:bg-slate-700${
          className ? ` ${className}` : ''
        }`}
      />
    );
  // Nothing is counted for this row (Largest Image, or a feature nobody has used): the place stays quiet, and a
  // screen reader is still told the cell is not empty by mistake.
  if (!used) return <span className="sr-only">Not applicable</span>;
  const hot = used.state === 'reached' || focused;
  return (
    <span className={`flex flex-col gap-1.5${className ? ` ${className}` : ''}`}>
      <span
        className={`font-medium tabular-nums ${
          hot ? 'text-amber-800 dark:text-amber-300' : 'text-slate-800 dark:text-slate-100'
        }`}
      >
        {used.words}
      </span>
      {used.limit === null ? null : (
        <span
          aria-hidden
          className="block h-[5px] w-[120px] max-w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700"
        >
          <span
            className={`block h-full rounded-full ${
              hot ? 'bg-amber-500 dark:bg-amber-400' : 'bg-brand-600 dark:bg-brand-400'
            }`}
            style={{ width: `${used.used > 0 ? Math.max(used.fraction * 100, 2) : 0}%` }}
          />
        </span>
      )}
    </span>
  );
}
