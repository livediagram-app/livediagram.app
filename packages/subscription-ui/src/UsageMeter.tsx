'use client';

import { limitRow, type LimitKey } from '@liveworkspace/subscription';
import { proOn } from './flag';
import { ProBadge } from './ProBadge';
import { meterFraction, meterState, usageWords, type MeterState } from './usage';

export type UsageMeterProps = {
  /** Which limit this counts against: its row words the numbers ("205 of 250 today", "312 MB of 500 MB"). */
  limitKey: LimitKey;
  used: number;
  /** The owner's limit, from their owner view or entitlement. `null` is unlimited: the count alone, with no bar. */
  limit: number | null;
  /** What is being counted, before the bar: "Runs This Month". The row's own label when not given. */
  label?: string;
  /** False where the row already says what is counted: the bar and numbers alone, the label still naming the meter. */
  showLabel?: boolean;
  /** `inline`: label, bar and numbers on one line. `stacked`: label and numbers over a full-width bar. `auto` (the
   *  default): stacked on a phone, inline from `sm` up. */
  layout?: 'auto' | 'inline' | 'stacked';
  /** The numbers in the caller's own words, where it counts what is left: "38 of 50 AI credits left this month".
   *  The row's own ("12 of 50 this month") when not given. */
  words?: string;
  /** False where the caller draws the numbers itself, larger, over the bar (a Space's Call Minutes): the bar alone,
   *  the words still read out with it. */
  showWords?: boolean;
  /** The owner has Pro: the solid badge follows the numbers. */
  pro?: boolean;
  className?: string;
};

// Label, bar and numbers. On one line the bar is a fixed 120px between them; stacked, the numbers sit at the row's
// right end and the bar runs the full width under both.
const LAYOUT: Record<
  NonNullable<UsageMeterProps['layout']>,
  { box: string; bar: string; end: string }
> = {
  inline: {
    box: 'flex items-center gap-2',
    bar: 'w-[120px] shrink-0',
    end: 'flex items-center gap-2',
  },
  stacked: {
    box: 'grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1.5',
    bar: 'order-3 col-span-2 w-full',
    end: 'order-2 flex items-center gap-2',
  },
  auto: {
    box: 'grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1.5 sm:flex sm:gap-2',
    bar: 'order-3 col-span-2 w-full sm:order-none sm:w-[120px] sm:shrink-0',
    end: 'order-2 flex items-center gap-2 sm:order-none',
  },
};

const FILL: Record<MeterState, string> = {
  unlimited: '',
  normal: 'bg-brand-600 dark:bg-brand-400',
  near: 'bg-brand-600 dark:bg-brand-400',
  // Amber is the limit's colour everywhere: the bar, the numbers and the notice under them.
  reached: 'bg-amber-500 dark:bg-amber-400',
};

/**
 * A count against a limit (subscription.md "What people see", "Meters and prompts in each app"): what is counted, a
 * bar and the numbers. The bar keeps the app's colour until the limit, where bar and numbers turn amber. The server
 * decides every limit; this only shows what it decided. Renders nothing with Pro off.
 */
export function UsageMeter({
  limitKey,
  used,
  limit,
  label,
  showLabel = true,
  layout = 'auto',
  words: given,
  showWords = true,
  pro = false,
  className,
}: UsageMeterProps) {
  if (!proOn()) return null;
  const row = limitRow(limitKey);
  const name = label ?? row.label;
  const state = meterState(used, limit);
  const words = given ?? usageWords(row, used, limit);
  const { box, bar, end } = LAYOUT[layout];
  // A sliver always shows once anything is used, so 3 of 1,500 does not read as nothing.
  const filled = meterFraction(used, limit);
  const width = `${used > 0 ? Math.max(filled * 100, 2) : 0}%`;
  return (
    <div
      data-usage-meter={state}
      className={`min-w-0 text-xs text-slate-500 dark:text-slate-400 ${box}${className ? ` ${className}` : ''}`}
    >
      {showLabel ? <span className="min-w-0 truncate">{name}</span> : null}
      {limit === null ? null : (
        <span
          role="meter"
          aria-label={name}
          aria-valuemin={0}
          aria-valuemax={limit}
          aria-valuenow={Math.min(Math.max(used, 0), limit)}
          aria-valuetext={words}
          className={`block h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700 ${bar}`}
        >
          <span
            className={`block h-full rounded-full transition-[width] duration-micro motion-reduce:transition-none ${FILL[state]}`}
            style={{ width }}
          />
        </span>
      )}
      {showWords || pro ? (
        <span className={end}>
          {showWords ? (
            <span
              className={`font-medium whitespace-nowrap tabular-nums ${
                state === 'reached'
                  ? 'text-amber-800 dark:text-amber-300'
                  : 'text-slate-700 dark:text-slate-200'
              }`}
            >
              {words}
            </span>
          ) : null}
          {pro ? <ProBadge form="solid" size="sm" /> : null}
        </span>
      ) : null}
    </div>
  );
}
