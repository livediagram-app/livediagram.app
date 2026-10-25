// The Pages tab's page-view helpers (docs/specs/017-telemetry/page-view-telemetry.md), kept pure so it is tested apart from
// the view. Everything reads the summary's existing page-view rows; nothing
// here needs a new query or identifies anybody.

import type { TelemetryCount } from '@liveworkspace/telemetry';
import { rank } from './rank';

const isPageView = (r: TelemetryCount) =>
  r.category === 'Page' && r.action === 'View' && r.type !== null;

/**
 * The page-view rows for one app (or every app), most viewed first. `appOf` is the app's own
 * pageViewApp (its api-schema): which of its frontends serves a path.
 */
export function pageViewRows(
  rows: TelemetryCount[],
  app: string,
  appOf: (path: string) => string | null,
): TelemetryCount[] {
  return rank(rows, (r) => isPageView(r) && (app === 'All' || appOf(r.type!) === app));
}
