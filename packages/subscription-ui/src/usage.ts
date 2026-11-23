// How a count against a limit reads (subscription.md "What people see", meters): its state, how full its bar is, and
// its words, all from the contract's rows so a limit is worded once.
import {
  formatUsage,
  limitReached,
  type LimitRow,
  type Limits,
  type SubscriptionSummary,
} from '@liveworkspace/subscription';

/** From this share of a limit a meter is "near": the nudge appears, the bar keeps its colour. */
export const NEAR_LIMIT = 0.8;

export type MeterState = 'unlimited' | 'normal' | 'near' | 'reached';

export function meterState(used: number, limit: number | null): MeterState {
  if (limit === null) return 'unlimited';
  if (limitReached(used, limit)) return 'reached';
  return limit > 0 && used / limit >= NEAR_LIMIT ? 'near' : 'normal';
}

/** How much of the bar is filled, 0 to 1. A limit of nothing is full. */
export function meterFraction(used: number, limit: number | null): number {
  if (limit === null) return 0;
  if (limit <= 0) return 1;
  return Math.min(1, Math.max(0, used / limit));
}

/** "today" for a daily count, "this month" for a monthly one, nothing for a standing count. */
export function periodWord(row: LimitRow): string {
  return row.per === 'a day' ? 'today' : row.per === 'a month' ? 'this month' : '';
}

/** "205 of 250 today", "312 MB of 500 MB", or the count alone against no limit. */
export function usageWords(row: LimitRow, used: number, limit: number | null): string {
  const period = periodWord(row);
  return `${formatUsage(row, used, limit)}${period ? ` ${period}` : ''}`;
}

/** A row's limit as a number to count against: null when it has none, or is not a count (Ask's own key). */
export function numericLimit(limits: Limits, row: LimitRow): number | null {
  const value = limits[row.key];
  return typeof value === 'number' ? value : null;
}

export type RowUsage = {
  used: number;
  limit: number | null;
  words: string;
  fraction: number;
  state: MeterState;
};

/** What an owner has used of a row, or null where the row has no usage to show: a limit that is not counted
 *  (Largest Image), or a feature the tier does not include and nobody has used. */
export function rowUsage(
  row: LimitRow,
  source: Pick<SubscriptionSummary, 'limits' | 'usage'>,
): RowUsage | null {
  if (!row.usage) return null;
  const entry = source.usage[row.usage];
  const used = entry?.used ?? 0;
  const value = source.limits[row.key];
  if (typeof value === 'boolean') return null;
  if (value === 0 && used === 0) return null;
  return {
    used,
    limit: value,
    words: usageWords(row, used, value),
    fraction: meterFraction(used, value),
    state: meterState(used, value),
  };
}
