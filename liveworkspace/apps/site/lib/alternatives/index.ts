// The comparison / "alternative" pages on liveworkspace.app (liveworkspace/docs/comparison-pages.md).
// The hub, each page, its metadata and the sitemap all read this list, so adding a competitor is a
// one-place change.
//
// Each app keeps its own list in its own file, written about that app. A comparison that draws on
// several apps (the whole suite against one competitor) goes in SUITE with every app it names.
//
// Honesty rules (liveworkspace/docs/comparison-pages.md): every claim maps to a shipped feature;
// every competitor gets a real "where they're the better pick" section; competitor facts are
// qualitative (positioning, not volatile pricing/numbers); free + open-source competitors are never
// implied to be paid or proprietary.

import { APP_SITES, type SiteId } from '@liveworkspace/sites';
import { LIVEDESIGN, LIVEDESIGN_UPDATED } from './livedesign';
import { LIVEDIAGRAM, LIVEDIAGRAM_UPDATED } from './livediagram';
import { LIVEDOCUMENTS, LIVEDOCUMENTS_UPDATED } from './livedocuments';
import { LIVEPLANNER, LIVEPLANNER_UPDATED } from './liveplanner';
import type { Alternative, AppAlternative } from './types';

export type { Alternative } from './types';

const forApp = (app: SiteId, list: AppAlternative[], updated: Date): Alternative[] =>
  list.map((alt) => ({ ...alt, apps: [app], updated }));

// Comparisons of the whole suite, or several apps of it, with one competitor. Listed first on the
// hub.
const SUITE: Alternative[] = [];

const BY_APP: Partial<Record<SiteId, Alternative[]>> = {
  'livediagram.app': forApp('livediagram.app', LIVEDIAGRAM, LIVEDIAGRAM_UPDATED),
  'liveplanner.app': forApp('liveplanner.app', LIVEPLANNER, LIVEPLANNER_UPDATED),
  'livedocuments.app': forApp('livedocuments.app', LIVEDOCUMENTS, LIVEDOCUMENTS_UPDATED),
  'livedesign.app': forApp('livedesign.app', LIVEDESIGN, LIVEDESIGN_UPDATED),
};

// The hub's groups: the suite's comparisons, then each app's, in the apps' shared order.
export const ALTERNATIVE_GROUPS: { app: SiteId | null; alternatives: Alternative[] }[] = [
  { app: null, alternatives: SUITE },
  ...APP_SITES.map((site) => ({ app: site.id, alternatives: BY_APP[site.id] ?? [] })),
].filter((group) => group.alternatives.length > 0);

export const ALTERNATIVES: Alternative[] = ALTERNATIVE_GROUPS.flatMap((g) => g.alternatives);

export const ALTERNATIVE_SLUGS = ALTERNATIVES.map((a) => a.slug);

// The newest review of any comparison: the hub's own date.
export const ALTERNATIVES_LAST_UPDATED = new Date(
  Math.max(...ALTERNATIVES.map((a) => a.updated.getTime())),
);

export function getAlternative(slug: string): Alternative | undefined {
  return ALTERNATIVES.find((a) => a.slug === slug);
}
