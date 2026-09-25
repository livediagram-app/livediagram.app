// The Pages tab's arithmetic (spec/150), kept pure so it is tested apart from
// the view. Everything reads the summary's existing page-view rows
// (`Page·View·<path>`) and their 30-day series; nothing here needs a new
// query or identifies anybody. Ratios are views over views, never people.

import {
  metricKey,
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

/** Total views of the pages a predicate picks. */
export function viewsOf(rows: TelemetryCount[], pick: (path: string) => boolean): number {
  return rows.filter((r) => isPageView(r) && pick(r.type!)).reduce((sum, r) => sum + r.count, 0);
}

/** Views of `to` per 100 views of `from`, or null when `from` had none. */
export function per100(
  rows: TelemetryCount[],
  from: (path: string) => boolean,
  to: (path: string) => boolean,
): number | null {
  const base = viewsOf(rows, from);
  return base === 0 ? null : Math.round((viewsOf(rows, to) / base) * 100);
}

export type Riser = { path: string; last7: number; prev7: number };

/**
 * Pages whose views grew most over the last 7 days against the 7 before,
 * biggest absolute gain first. Read from the 30-day series, so it doesn't
 * depend on the selected window. A page with no gain isn't a riser.
 */
export function risingPages(daily: TelemetryDaily, limit = 5): Riser[] {
  const prefix = metricKey('Page', 'View', '');
  const out: Riser[] = [];
  for (const [key, series] of Object.entries(daily.byMetric)) {
    if (!key.startsWith(prefix)) continue;
    const n = series.length;
    const sum = (from: number, to: number) =>
      series.slice(Math.max(0, from), to).reduce((a, b) => a + b, 0);
    const last7 = sum(n - 7, n);
    const prev7 = sum(n - 14, n - 7);
    if (last7 > prev7) out.push({ path: key.slice(prefix.length), last7, prev7 });
  }
  return out
    .sort((a, b) => b.last7 - b.prev7 - (a.last7 - a.prev7) || b.last7 - a.last7)
    .slice(0, limit);
}
