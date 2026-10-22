// The apps with a Community (liveworkspace/docs/community.md). One service holds every app's listings,
// and each app's pages show only their own, so every read and write names its app. An app is named by
// its public site, the way people know it.

import { APP_SITES } from '@liveworkspace/sites';

export const COMMUNITY_APPS = ['livediagram.app', 'liveplanner.app'] as const;

export type CommunityApp = (typeof COMMUNITY_APPS)[number];

export function isCommunityApp(value: unknown): value is CommunityApp {
  return typeof value === 'string' && (COMMUNITY_APPS as readonly string[]).includes(value);
}

// The browser origins an app's pages are served from: its site as SITES links to it, with and without
// `www.`, and its staging. Only these (and localhost, in development) may write to the service from a
// browser. Built from SITES, so a site's address changes in one place.
function originsOf(app: CommunityApp): readonly string[] {
  const site = APP_SITES.find((s) => s.id === app);
  const host = new URL(site?.url ?? `https://${app}`).hostname.replace(/^www\./, '');
  return [`https://${host}`, `https://www.${host}`, `https://staging.${host}`];
}

export const COMMUNITY_APP_ORIGINS: Record<CommunityApp, readonly string[]> = {
  'livediagram.app': originsOf('livediagram.app'),
  'liveplanner.app': originsOf('liveplanner.app'),
};

// The app an origin belongs to, or null for one no app serves.
export function communityAppOfOrigin(origin: string): CommunityApp | null {
  for (const app of COMMUNITY_APPS) {
    if (COMMUNITY_APP_ORIGINS[app].includes(origin)) return app;
  }
  return null;
}
