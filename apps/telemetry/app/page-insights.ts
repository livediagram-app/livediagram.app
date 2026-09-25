// The Pages tab's arithmetic (spec/150), kept pure so it is tested apart from
// the view. Everything reads the summary's existing rows and 30-day series;
// nothing here needs a new query or identifies anybody. Ratios are counts over
// counts (views over views, or an event over the views that lead to it), never
// people: nothing links one event to another.

import {
  pageViewApp,
  type PageViewApp,
  type TelemetryCount,
  type TelemetryDaily,
} from '@livediagram/api-schema';
import { rank } from './rank';

export const PAGE_VIEW_APPS: PageViewApp[] = ['Marketing', 'Live', 'Help', 'Dashboard'];

const isPageView = (r: TelemetryCount) =>
  r.category === 'Page' && r.action === 'View' && r.type !== null;

/** The page-view rows for one app (or every app), most viewed first. */
export function pageViewRows(rows: TelemetryCount[], app: PageViewApp | 'All'): TelemetryCount[] {
  return rank(rows, (r) => isPageView(r) && (app === 'All' || pageViewApp(r.type!) === app));
}

// ---- Insights: one count over another, with its trend -----------------------

/** Picks the events one side of an insight counts. */
export type EventPick = (category: string, action: string, type: string | null) => boolean;

/** A page view whose path passes `pick`. */
export const pageView =
  (pick: (path: string) => boolean): EventPick =>
  (category, action, type) =>
    category === 'Page' && action === 'View' && type !== null && pick(type);

/** Every type of one category·action. */
export const event =
  (category: string, action: string): EventPick =>
  (c, a) =>
    c === category && a === action;

export type InsightDef = {
  id: string;
  title: string;
  detail: string; // what the number means, in a sentence
  from: EventPick; // the denominator
  to: EventPick; // the numerator
  fromLabel: string; // short names for the flow line: "/" -> "/new"
  toLabel: string;
  scale: 100 | 1; // per 100 (a rate) or per 1 (an average)
  unit: string; // "per 100", "pages"
  // Whether a rise is good news, which colours the change. Neutral where it
  // could read either way (more help per diagram: engaged, or stuck?).
  rising: 'good' | 'neutral';
};

export type InsightReading = {
  value: number | null; // null when the denominator had nothing
  to: number;
  from: number;
  // The same span immediately before the window, or null when page views
  // weren't being recorded yet for all of it (or the 30 days of series don't
  // reach back that far, as behind the 30-day window).
  previous: number | null;
  // Per day across the 30 days, a trailing 7-day ratio so one quiet day
  // doesn't spike the line; null before page views began and while the
  // denominator is still zero.
  trend: (number | null)[];
  // The UTC day page views began, when that falls inside the window: the
  // counts above start there, not at the window's first day.
  since: number | null;
};

const ratio = (to: number, from: number, scale: number): number | null =>
  from === 0 ? null : (to / from) * scale;

function windowSum(rows: TelemetryCount[], pick: EventPick): number {
  return rows
    .filter((r) => pick(r.category, r.action, r.type))
    .reduce((sum, r) => sum + r.count, 0);
}

/** The element-wise sum of every 30-day series the pick matches. */
export function pickedSeries(daily: TelemetryDaily, pick: EventPick): number[] {
  const out = new Array<number>(daily.days.length).fill(0);
  for (const [key, series] of Object.entries(daily.byMetric)) {
    const [category = '', action = '', type = ''] = key.split('|');
    if (!pick(category, action, type === '' ? null : type)) continue;
    for (let i = 0; i < out.length; i++) out[i]! += series[i] ?? 0;
  }
  return out;
}

const sumRange = (series: number[], start: number, end: number) =>
  series.slice(Math.max(0, start), end).reduce((a, b) => a + b, 0);

const TREND_SPAN = 7;

/**
 * The first day of the series with any page view: when page-view telemetry
 * (spec/150) started reaching this deployment. Before it, a page-view side
 * reads zero because nothing was measured, not because nobody visited.
 */
export function pageViewsBegin(daily: TelemetryDaily): number {
  const views = pickedSeries(
    daily,
    pageView(() => true),
  );
  const first = views.findIndex((n) => n > 0);
  return first === -1 ? views.length : first;
}

/**
 * Read one insight for the selected window. Both sides count only from the
 * day page views began: a rate that set a month of diagrams created against
 * two days of wizard views would read 500 per 100. Without the 30-day series
 * (an older api), the window's own rows are all there is.
 */
export function readInsight(
  def: InsightDef,
  rows: TelemetryCount[],
  daily: TelemetryDaily | undefined,
  windowDays: number,
): InsightReading {
  if (!daily) {
    const to = windowSum(rows, def.to);
    const from = windowSum(rows, def.from);
    return { value: ratio(to, from, def.scale), to, from, previous: null, trend: [], since: null };
  }
  const toDays = pickedSeries(daily, def.to);
  const fromDays = pickedSeries(daily, def.from);
  const n = daily.days.length;
  const begin = pageViewsBegin(daily);
  const windowStart = Math.max(0, n - windowDays);
  const start = Math.max(windowStart, begin);
  const to = sumRange(toDays, start, n);
  const from = sumRange(fromDays, start, n);
  const prevStart = n - 2 * windowDays;
  const previous =
    prevStart >= begin && prevStart >= 0
      ? ratio(
          sumRange(toDays, prevStart, windowStart),
          sumRange(fromDays, prevStart, windowStart),
          def.scale,
        )
      : null;
  const trend = toDays.map((_, i) => {
    if (i < begin) return null;
    const lo = Math.max(begin, i - TREND_SPAN + 1);
    return ratio(sumRange(toDays, lo, i + 1), sumRange(fromDays, lo, i + 1), def.scale);
  });
  return {
    value: ratio(to, from, def.scale),
    to,
    from,
    previous,
    trend,
    since: start > windowStart && begin < n ? (daily.days[begin] ?? null) : null,
  };
}
