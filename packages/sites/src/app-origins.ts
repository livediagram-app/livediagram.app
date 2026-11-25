// Every address an app answers on, per environment (liveworkspace/docs/specs/003-accounts/accounts.md "Signing in on the app's own
// address"). The accounts Worker accepts a sign-in hand-off back to these and nowhere else, beside its own check that
// the address is one of the app's registered OAuth redirect URIs; the sign-in pages read them to know when they are
// being served under an app's address. Kept Worker-safe: no Node, no DOM.

import { isStagingHost, LOCAL_PORTS, REGISTERED_APP_SITES, type Site, type SiteId } from './index';

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

/** `site`'s address as a page on `host` reaches it: its staging origin from a staging page, its live address anywhere
 *  else (production, and locally). The origin a link to another app is built on. */
export function siteUrlFrom(site: Site, host: string): string {
  return isStagingHost(host) ? stagingOrigin(site.id) : site.url;
}

/** The same, for the page this code is running on (the live address while there is no page, as when prerendered). */
export function siteUrlHere(site: Site): string {
  // Read off globalThis, so a Worker that imports this module (with no DOM types) still compiles.
  const page = (globalThis as { window?: { location?: { host?: string } } }).window;
  return siteUrlFrom(site, page?.location?.host ?? '');
}

/** The app an origin belongs to in `environment`, or null (liveworkspace.app itself, or anywhere else). Only an exact
 *  origin matches: no other port, scheme or subdomain. A held app's origins count: the services accept it before it
 *  is listed anywhere. */
export function appOfOrigin(origin: string, environment: AppEnvironment): AppSiteId | null {
  let normal: string;
  try {
    normal = new URL(origin).origin;
  } catch {
    return null;
  }
  for (const site of REGISTERED_APP_SITES) {
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

// --- A live embed's frame (liveworkspace/docs/specs/004-index/live-embeds.md "Framed by our apps alone") -------------

// The frame flag a host adds to a live embed's frame address (@liveworkspace/workbench editor-surface.ts
// LIVE_EMBED_FRAME_PARAM, restated so a worker reads it without the workbench).
const LIVE_EMBED_FRAME_PARAM = 'live';

/** Whether a request is for a live embed's frame: the workbench page with the frame flag. */
export function isLiveEmbedFrameRequest(url: URL): boolean {
  return (
    (url.pathname === '/embed/workbench' || url.pathname === '/embed/workbench/') &&
    url.searchParams.get(LIVE_EMBED_FRAME_PARAM) === '1'
  );
}

const isLoopbackHost = (host: string) =>
  host === 'localhost' || host === '127.0.0.1' || host === '[::1]';

/**
 * The `frame-ancestors` sources for a live embed's frame served at `url` (live-embeds.md "Framed by our apps alone"),
 * or null for any other request: every app's origins in the environment the frame's own origin belongs to, so only a
 * page of one of our apps can frame it. Staging's apps on a staging frame; any local port on a loopback one (each
 * app's dev servers answer on more than their router's port); production's anywhere else.
 */
export function liveEmbedFrameAncestors(url: URL): string | null {
  if (!isLiveEmbedFrameRequest(url)) return null;
  if (isLoopbackHost(url.hostname)) return "'self' http://localhost:* http://127.0.0.1:*";
  const environment: AppEnvironment = isStagingHost(url.host) ? 'staging' : 'production';
  const origins = REGISTERED_APP_SITES.flatMap((site) =>
    appOrigins(site.id as AppSiteId, environment),
  );
  return ["'self'", ...origins].join(' ');
}
