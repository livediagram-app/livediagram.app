// The Pages tab's page-view helpers (spec/150), kept pure so it is tested apart from
// the view. Everything reads the summary's existing page-view rows; nothing
// here needs a new query or identifies anybody.

import { pageViewApp, type PageViewApp, type TelemetryCount } from '@livediagram/api-schema';
import { rank } from './rank';

export const PAGE_VIEW_APPS: PageViewApp[] = ['Marketing', 'Live', 'Help', 'Dashboard'];

const isPageView = (r: TelemetryCount) =>
  r.category === 'Page' && r.action === 'View' && r.type !== null;

/** The page-view rows for one app (or every app), most viewed first. */
export function pageViewRows(rows: TelemetryCount[], app: PageViewApp | 'All'): TelemetryCount[] {
  return rank(rows, (r) => isPageView(r) && (app === 'All' || pageViewApp(r.type!) === app));
}
