// Where the Explorer page is being shown (liveworkspace/docs/specs/010-site/site.md "The Explorer"). It is built once, here, and
// served two ways: on liveworkspace.app itself, and under an app's own address through that app's router
// (`liveplanner.app/explorer/…`, @liveworkspace/sites/workspace-proxy), where the address bar keeps the app's name.
// On an app's address the page is that app's: it signs in with the app's own session (its refresh cookie and its
// guest token live on that origin), reads the app's offline items, and sends every link that belongs to
// liveworkspace.app (account pages, its home) there in full.
//
// A static page can't see the request, so it reads where it is from its own address. Small and dependency-light:
// every page's header asks it (lib/session.ts).

import {
  APP_ITEMS,
  APP_NAMES,
  LOCAL_PORTS,
  workspaceOriginFor,
  siteOfApp,
  type AppName,
} from '@liveworkspace/sites';

// ---------- Which address the page is on ------------------------------------------------------------------------

const bareHost = (host: string) => host.toLowerCase().replace(/^(?:www|staging)\./, '');

/** Every address an app serves the Explorer on: its live host and its local router's port. */
export function appHosts(): Record<string, AppName> {
  const hosts: Record<string, AppName> = {};
  for (const app of APP_NAMES) {
    const site = APP_ITEMS[app].site;
    hosts[site] = app;
    hosts[`localhost:${LOCAL_PORTS[site]}`] = app;
  }
  return hosts;
}

// Locally, each app owns a block of a hundred ports from its router's (the root AGENTS.md): its router takes the
// first, its other apps and its E2E stack the rest (`:3102`, `:3115`). The page on any of them is the app's; read as
// liveworkspace.app, it asked for a session token no app serves and showed "couldn't reach your account". Only the
// page's own address is read this way: appOfHost (which vets return addresses) still knows each router's port alone.
const PORT_BLOCK = 100;

function appOfLocalPort(host: string): AppName | null {
  const match = /^(?:localhost|127\.0\.0\.1):(\d+)$/.exec(host);
  if (!match) return null;
  const block = Math.floor(Number(match[1]) / PORT_BLOCK) * PORT_BLOCK;
  return APP_NAMES.find((app) => LOCAL_PORTS[APP_ITEMS[app].site] === block) ?? null;
}

/** The app whose address `host` is (with or without `www.` or `staging.`), or null for liveworkspace's own. */
export function appOfHost(host: string): AppName | null {
  return appHosts()[bareHost(host)] ?? null;
}

/** The app whose address a page on `host` is on: appOfHost's, or locally any port in an app's block. */
export function appOfPageHost(host: string): AppName | null {
  return appOfHost(host) ?? appOfLocalPort(bareHost(host));
}

let seen: { host: string; app: AppName | null } | null = null;

/** The app whose address the page is on, or null on liveworkspace.app (and while prerendered). */
export function pageApp(): AppName | null {
  if (typeof window === 'undefined') return null;
  const host = window.location?.host ?? '';
  if (!seen || seen.host !== host) seen = { host, app: appOfPageHost(host) };
  return seen.app;
}

/** liveworkspace.app's origin, from wherever the page is: staging's from a staging app. */
export function workspaceOrigin(): string {
  return workspaceOriginFor(typeof window === 'undefined' ? '' : window.location.host);
}

/** A path on liveworkspace.app: as it is there, in full on an app's address. */
export function workspaceHref(path: string): string {
  return pageApp() ? `${workspaceOrigin()}${path}` : path;
}

/** An app's origin: this page's own when the page is on that app's address (same origin, no CORS, the app's own
 *  host whether or not it has `www.`), else the registry's. */
export function appOrigin(app: AppName): string {
  if (pageApp() === app) return window.location.origin;
  return siteOfApp(app).url;
}
