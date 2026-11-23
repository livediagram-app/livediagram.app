// The UTC day and month a count belongs to (subscription.md "Tiers and limits").

const DAY_MS = 24 * 60 * 60 * 1000;

/** `2026-11-20`. */
export function dayKey(now: number): string {
  return new Date(now).toISOString().slice(0, 10);
}

/** `2026-11`. */
export function monthKey(now: number): string {
  return new Date(now).toISOString().slice(0, 7);
}

/** Midnight UTC at the start of `now`'s day. */
export function dayStart(now: number): number {
  return Math.floor(now / DAY_MS) * DAY_MS;
}

/** Midnight UTC on the first of `now`'s month. */
export function monthStart(now: number): number {
  const date = new Date(now);
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1);
}

/** Midnight UTC on the first of the month after `now`'s: when a monthly count starts again. */
export function nextMonthStart(now: number): number {
  const date = new Date(now);
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1);
}

/** The UTC day of the month `at` falls on: the day a subscription taken then renews on. */
export function anchorDayOf(at: number): number {
  return new Date(at).getUTCDate();
}

/**
 * One month on from `from`, on the subscription's anchor day (the day of the month it was taken on), held to that
 * month's last day: a subscription taken on the 31st renews on the 28th of February and the 31st of March. Without
 * an anchor it is `from`'s own day.
 */
export function addMonth(from: number, anchorDay?: number): number {
  const date = new Date(from);
  const anchored =
    typeof anchorDay === 'number' &&
    Number.isInteger(anchorDay) &&
    anchorDay >= 1 &&
    anchorDay <= 31;
  const day = anchored ? anchorDay : date.getUTCDate();
  const next = new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth() + 1,
      1,
      date.getUTCHours(),
      date.getUTCMinutes(),
      date.getUTCSeconds(),
      date.getUTCMilliseconds(),
    ),
  );
  const lastDay = new Date(Date.UTC(next.getUTCFullYear(), next.getUTCMonth() + 1, 0)).getUTCDate();
  next.setUTCDate(Math.min(day, lastDay));
  return next.getTime();
}
