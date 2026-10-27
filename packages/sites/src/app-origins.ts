// Every address an app answers on, per environment (liveworkspace/docs/specs/003-accounts/accounts.md "Signing in on the app's own
// address"). The accounts Worker accepts a sign-in hand-off back to these and nowhere else, beside its own check that
// the address is one of the app's registered OAuth redirect URIs; the sign-in pages read them to know when they are
// being served under an app's address. Kept Worker-safe: no Node, no DOM.

import { APP_SITES, isStagingHost, LOCAL_PORTS, type Site, type SiteId } from './index';

export type AppSiteId = Exclude<SiteId, 'liveworkspace.app'>;

/** Which deployment: the accounts Worker's ENVIRONMENT. */
export type AppEnvironment = 'production' | 'staging' | 'development';

/** The origins `site` answers on in `environment`: its bare and www hosts in production, `staging.` on staging, its
 *  local port block's first port (the router's) in development. */
export function appOrigins(site: AppSiteId, environment: AppEnvironment): string[] {
  if (environment === 'development') {
    const port = LOCAL_PORTS[site];
    return [`http://localhost:${port}`, `http://127.0.0.1:${port}`];
  }
  if (environment === 'staging') return [`https://staging.${site}`];
  return [`https://${site}`, `https://www.${site}`];
}

/** `site`'s staging origin: `staging.<site>`. */
export function stagingOrigin(site: SiteId): string {
  return `https://staging.${site}`;
}

/** A link to `site` (`href`, on its live origin `site.url`) as a page on `host` gives it: moved to the site's staging
 *  origin from a staging page (liveworkspace/docs/specs/010-site/site-switcher.md), unchanged anywhere else. */
export function siteHrefFrom(site: Site, href: string, host: string): string {
  if (!isStagingHost(host) || !href.startsWith(site.url)) return href;
  return `${stagingOrigin(site.id)}${href.slice(site.url.length)}`;
}

/** The app an origin belongs to in `environment`, or null (liveworkspace.app itself, or anywhere else). Only an exact
 *  origin matches: no other port, scheme or subdomain. */
export function appOfOrigin(origin: string, environment: AppEnvironment): AppSiteId | null {
  let normal: string;
  try {
    normal = new URL(origin).origin;
  } catch {
    return null;
  }
  for (const site of APP_SITES) {
    const id = site.id as AppSiteId;
    if (appOrigins(id, environment).includes(normal)) return id;
  }
  return null;
}

/** The same, in whichever environment it is: what a page uses when it doesn't know which deployment it is part of. */
export function appOfAnyOrigin(origin: string): AppSiteId | null {
  for (const environment of ['production', 'staging', 'development'] as const) {
    const site = appOfOrigin(origin, environment);
    if (site) return site;
  }
  return null;
}
