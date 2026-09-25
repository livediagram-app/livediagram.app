// The Pages tab's arithmetic (spec/150), kept pure so it is tested apart from
// the view. Everything reads the summary's existing page-view rows
// (`Page·View·<path>`); nothing here needs a new query or identifies anybody. Ratios are views over views, never people.

import { pageViewApp, type PageViewApp, type TelemetryCount } from '@livediagram/api-schema';
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
