// liveworkspace pages served under an app's own address (liveworkspace/docs/one-explorer.md "The Explorer on
// each app's address"). An app's router answers some paths by fetching them from liveworkspace.app, so the
// address bar keeps the app's name: `liveplanner.app/explorer/recent` shows the Explorer the site builds once,
// with liveplanner's session, offline items and colours. Every app's router uses this one helper, so turning it on
// for another app is one flag here and one route line in that app's router.
//
// Kept dependency-free and Worker-safe (fetch, URL, Headers only): it runs inside each app's router.

import { APP_ITEMS, explorerUrl, type AppName } from './index';

/** Where liveworkspace.app lives when the router names no other (`WORKSPACE_ORIGIN`). */
export const PRODUCTION_WORKSPACE_ORIGIN = 'https://liveworkspace.app';

// Set on every request a router forwards, naming the app. A request that already carries it was forwarded once,
// so a router that finds it refuses rather than forward again: a misconfigured origin can never loop.
export const WORKSPACE_PROXY_HEADER = 'X-Liveworkspace-Proxy';
// The visitor's address as the router saw it. A Worker's request to another site arrives from the Worker, so
// liveworkspace's per-network limits (a sign-in code's) would otherwise count every app's visitors as one.
export const WORKSPACE_CLIENT_IP_HEADER = 'X-Liveworkspace-Client-IP';

// ---------- The per-app switch ------------------------------------------------------------------------------------
// Whether the app serves liveworkspace's Explorer at its own /explorer. An app turns it on once its items are on
// the index and the Explorer holds everything its own did (scratchpad's index-app kit notes say how). Off, the app's
// router leaves /explorer to the app's own editor as before.
export const EXPLORER_ON_APP_ORIGIN: Record<AppName, boolean> = {
  livediagram: true,
  liveplanner: true,
  livedocuments: true,
  livedesign: true,
};

/** Where an app's own pages open the Explorer's Home: its own `/explorer/home` while the switch is on (or while its
 *  items aren't on the index and it keeps its own Explorer), else liveworkspace.app's, opened from the app. */
export function explorerHomeHref(app: AppName): string {
  return EXPLORER_ON_APP_ORIGIN[app] || !APP_ITEMS[app].onIndex
    ? '/explorer/home'
    : explorerUrl(app);
}

// ---------- What is forwarded ---------------------------------------------------------------------------------------

export type WorkspaceRoute = {
  // The path on the app's origin: matched as itself, anything under it (`/`), or a file beside it (`.txt`, the
  // static export's RSC payload for that very page).
  prefix: string;
  // The same place on liveworkspace.app; usually the prefix itself.
  target: string;
  // Cookies belong to the origin that set them. `drop`: the app's cookies never leave for liveworkspace, and
  // liveworkspace's never land on the app's origin. `pass`: a page whose session is meant to live on the app's
  // origin keeps both ways. `flow`: liveworkspace's cookies live on the app's origin only for the length of a
  // sign-in, renamed (`lw_flow.<name>`), scoped to this route's path and capped at FLOW_COOKIE_MAX_AGE_SECONDS; only
  // those go back, under their own names, and the app's own cookies never leave.
  cookies: 'drop' | 'pass' | 'flow';
  // Matched only when this also holds (the sign-in pages: only with an OAuth request in the query).
  when?: (url: URL) => boolean;
};

/** The Explorer's pages and their payloads (`/explorer`, `/explorer/…`, `/explorer.txt`). Its build assets are not
 *  here: the site's `assetPrefix` points them at liveworkspace.app itself, so they never collide with the app's own
 *  `/_next`. */
export const EXPLORER_ROUTE: WorkspaceRoute = {
  prefix: '/explorer',
  target: '/explorer',
  cookies: 'drop',
};

/** The few account reads the Explorer makes (people's names, teams, settings), with the app's bearer token. Under a
 *  path of its own because an app's API may own `/api/account` (liveplanner's account delete does). */
export const ACCOUNT_ROUTE: WorkspaceRoute = {
  prefix: '/api/workspace/account',
  target: '/api/account',
  cookies: 'drop',
};

// ---------- Signing in on the app's own address -------------------------------------------------------------------
// (liveworkspace/docs/accounts.md "Signing in on the app's own address"). The accounts site's sign-in, registration
// and consent pages are served under the app's address when they carry an OAuth request (the accounts Worker sends
// them there, signed, with `sig`); without one the path stays the app's own (its sign-in hand-off page). The few
// accounts calls those pages make go under /api/workspace/auth, beside the app's own /api/auth.

const hasSignedRequest = (url: URL) => url.searchParams.has('sig');

/** The pages: `/sign-in`, `/sign-up` and `/consent`, each only with a signed OAuth request in its query. */
export const SIGN_IN_PAGE_ROUTES: readonly WorkspaceRoute[] = [
  '/sign-in',
  '/sign-up',
  '/consent',
].map((path): WorkspaceRoute => ({
  prefix: path,
  target: path,
  cookies: 'drop',
  when: hasSignedRequest,
}));

/** Where the pages reach the accounts API on an app's address. */
export const ACCOUNTS_ON_APP_PATH = '/api/workspace/auth';

/** The accounts API under it, with the sign-in's own short-lived cookies (`flow`). */
export const ACCOUNTS_ROUTE: WorkspaceRoute = {
  prefix: ACCOUNTS_ON_APP_PATH,
  target: '/api/auth',
  cookies: 'flow',
};

/** How long a sign-in's cookie may live on the app's address: the emailed code's ten minutes, and some to type it. */
export const FLOW_COOKIE_MAX_AGE_SECONDS = 900;
export const FLOW_COOKIE_PREFIX = 'lw_flow.';

/** The site's build assets (its `assetPrefix`, liveworkspace/apps/site/next.config.ts): a path of their own, so they
 *  never collide with the app's own `/_next`, and the same in every environment, so one build serves them all. */
export const SITE_ASSET_PREFIX = '/_liveworkspace';
export const SITE_ASSETS_ROUTE: WorkspaceRoute = {
  prefix: SITE_ASSET_PREFIX,
  target: SITE_ASSET_PREFIX,
  cookies: 'drop',
};

/** The routes an app's router forwards to liveworkspace.app: signing in (and the site's assets) always, the
 *  Explorer's while the app's switch is on. */
export function workspaceRoutes(app: AppName): readonly WorkspaceRoute[] {
  const signIn = [...SIGN_IN_PAGE_ROUTES, ACCOUNTS_ROUTE, SITE_ASSETS_ROUTE];
  return EXPLORER_ON_APP_ORIGIN[app] ? [EXPLORER_ROUTE, ACCOUNT_ROUTE, ...signIn] : signIn;
}

function underPrefix(pathname: string, prefix: string): boolean {
  if (pathname === prefix) return true;
  if (!pathname.startsWith(prefix)) return false;
  const next = pathname.charAt(prefix.length);
  return next === '/' || next === '.';
}

/** The route a path falls under, or null. `url` answers routes that also look at the query. */
export function workspaceRouteFor(
  pathname: string,
  routes: readonly WorkspaceRoute[],
  url?: URL,
): WorkspaceRoute | null {
  return (
    routes.find(
      (route) =>
        underPrefix(pathname, route.prefix) && (!route.when || (url ? route.when(url) : false)),
    ) ?? null
  );
}

// ---------- A sign-in's cookies on the app's address ----------------------------------------------------------------

/** The Cookie header liveworkspace sees from a `flow` route: only the sign-in's own cookies, under their own names. */
export function flowCookiesIn(header: string | null): string | null {
  if (!header) return null;
  const kept: string[] = [];
  for (const part of header.split(';')) {
    const pair = part.trim();
    if (pair.startsWith(FLOW_COOKIE_PREFIX)) kept.push(pair.slice(FLOW_COOKIE_PREFIX.length));
  }
  return kept.length > 0 ? kept.join('; ') : null;
}

/** One Set-Cookie from liveworkspace as it lands on the app's address: renamed, on the route's path alone, HttpOnly,
 *  Secure, SameSite=Lax and never longer than FLOW_COOKIE_MAX_AGE_SECONDS. A cookie being cleared stays cleared. */
export function flowCookieOut(setCookie: string, path: string, now = Date.now()): string | null {
  const [pair = '', ...attributes] = setCookie.split(';');
  const eq = pair.indexOf('=');
  const name = eq > 0 ? pair.slice(0, eq).trim() : '';
  if (!name || !/^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/.test(name)) return null;
  const value = pair.slice(eq + 1).trim();
  let maxAge: number | null = null;
  for (const attribute of attributes) {
    const [key = '', ...rest] = attribute.split('=');
    const lower = key.trim().toLowerCase();
    const raw = rest.join('=').trim();
    if (lower === 'max-age') {
      const n = Number.parseInt(raw, 10);
      if (Number.isFinite(n)) maxAge = n;
    } else if (lower === 'expires' && maxAge === null) {
      const at = Date.parse(raw);
      if (Number.isFinite(at)) maxAge = Math.floor((at - now) / 1000);
    }
  }
  const life =
    maxAge !== null && maxAge <= 0
      ? 0
      : Math.min(maxAge ?? FLOW_COOKIE_MAX_AGE_SECONDS, FLOW_COOKIE_MAX_AGE_SECONDS);
  return `${FLOW_COOKIE_PREFIX}${name}=${life === 0 ? '' : value}; Path=${path}; Max-Age=${life}; HttpOnly; Secure; SameSite=Lax`;
}

const swapPrefix = (pathname: string, from: string, to: string) =>
  `${to}${pathname.slice(from.length)}`;

// ---------- Forwarding -------------------------------------------------------------------------------------------

export type ProxyOptions = {
  app: AppName;
  // `WORKSPACE_ORIGIN`: unset means production's.
  origin?: string;
  // The routes to answer; the app's own by default.
  routes?: readonly WorkspaceRoute[];
  // For tests.
  fetch?: typeof fetch;
};

const LOOP_DETECTED = 508;

function loop(reason: string): Response {
  return new Response(`router: ${reason}`, {
    status: LOOP_DETECTED,
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}

/** A redirect from liveworkspace that points inside a forwarded route comes back to the app's own address, so the
 *  person stays on it (the static site's `/explorer/recent/` → `/explorer/recent`, say). Others pass as they are. */
export function locationOnApp(
  location: string,
  workspaceOrigin: string,
  routes: readonly WorkspaceRoute[],
): string {
  let target: URL;
  try {
    target = new URL(location, workspaceOrigin);
  } catch {
    return location;
  }
  const relative = location.startsWith('/') && !location.startsWith('//');
  if (!relative && target.origin !== new URL(workspaceOrigin).origin) return location;
  const back = routes.find((r) => underPrefix(target.pathname, r.target));
  if (!back) return location;
  return `${swapPrefix(target.pathname, back.target, back.prefix)}${target.search}${target.hash}`;
}

/** Forwards a request under one of `routes` to liveworkspace.app, or answers null when none matches. Path and
 *  query are kept (the fragment never leaves the browser, which keeps it), and so are the method, the body and
 *  `Authorization`. */
export function routeToWorkspace(
  request: Request,
  options: ProxyOptions,
): Promise<Response> | null {
  const url = new URL(request.url);
  const routes = options.routes ?? workspaceRoutes(options.app);
  const route = workspaceRouteFor(url.pathname, routes, url);
  if (!route) return null;
  return forwardToWorkspace(request, url, route, routes, options);
}

async function forwardToWorkspace(
  request: Request,
  url: URL,
  route: WorkspaceRoute,
  routes: readonly WorkspaceRoute[],
  options: ProxyOptions,
): Promise<Response> {
  const origin = options.origin || PRODUCTION_WORKSPACE_ORIGIN;
  const target = new URL(
    `${swapPrefix(url.pathname, route.prefix, route.target)}${url.search}`,
    origin,
  );
  if (request.headers.has(WORKSPACE_PROXY_HEADER)) return loop('already forwarded once');
  if (target.host === url.host) return loop('WORKSPACE_ORIGIN is this site');

  const headers = new Headers(request.headers);
  if (route.cookies === 'drop') headers.delete('Cookie');
  if (route.cookies === 'flow') {
    const flow = flowCookiesIn(request.headers.get('Cookie'));
    if (flow) headers.set('Cookie', flow);
    else headers.delete('Cookie');
  }
  headers.set(WORKSPACE_PROXY_HEADER, options.app);
  const client = request.headers.get('CF-Connecting-IP');
  if (client) headers.set(WORKSPACE_CLIENT_IP_HEADER, client);
  else headers.delete(WORKSPACE_CLIENT_IP_HEADER);
  headers.set('X-Forwarded-Host', url.host);
  // Built from the request itself, so its method and body come along as they are.
  const forwarded = new Request(new Request(target.toString(), request), {
    headers,
    redirect: 'manual',
  });
  const response = await (options.fetch ?? fetch)(forwarded);

  const location = response.headers.get('Location');
  const rewriteCookies = route.cookies !== 'pass' && response.headers.has('Set-Cookie');
  if (!location && !rewriteCookies) return response;
  const out = new Headers(response.headers);
  if (location) out.set('Location', locationOnApp(location, origin, routes));
  if (rewriteCookies) {
    out.delete('Set-Cookie');
    if (route.cookies === 'flow') {
      for (const set of response.headers.getSetCookie()) {
        const scoped = flowCookieOut(set, route.prefix);
        if (scoped) out.append('Set-Cookie', scoped);
      }
    }
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: out,
  });
}

// ---------- The index, on the app's address -------------------------------------------------------------------------

/** Where liveworkspace's index lives when the router names no other (`INDEX_ORIGIN`). */
export const PRODUCTION_INDEX_ORIGIN = 'https://liveworkspace.app';

/**
 * `/api/index/*` on an app's address: the same request (method, body, Authorization, the share headers) at the
 * index's origin, minus this site's cookies, which are not the index's to read. Its redirects pass back as they are.
 * The visitor's address goes along (WORKSPACE_CLIENT_IP_HEADER, never one the caller sent), so what the index counts
 * per network (a Community post's copies) counts the visitor's, not the router's.
 */
export function forwardToIndex(
  request: Request,
  url: URL,
  origin: string,
  doFetch: typeof fetch = fetch,
): Promise<Response> {
  const target = new URL(`${url.pathname}${url.search}`, origin);
  const forwarded = new Request(target.toString(), request);
  forwarded.headers.delete('Cookie');
  const client = request.headers.get('CF-Connecting-IP');
  if (client) forwarded.headers.set(WORKSPACE_CLIENT_IP_HEADER, client);
  else forwarded.headers.delete(WORKSPACE_CLIENT_IP_HEADER);
  return doFetch(forwarded);
}

// ---------- Previews, on the app's address ---------------------------------------------------------------------------
// (liveworkspace/docs/previews.md). Every app's item pictures are liveworkspace's media service's, under
// /api/previews. The router forwards them, and a share link's three public doors at the address every app has always
// served them on (`/api/share/<code>/image.svg|image.png|card`), so live images already embedded keep working.
// `@liveworkspace/media` names the same paths (PREVIEWS_API_PATH, SHARE_PREVIEW_DOORS); this file stays
// dependency-free, so they are written out here, and media's tests hold the two together.

/** Where previews live when the router names no other (`PREVIEWS_ORIGIN`). */
export const PRODUCTION_PREVIEWS_ORIGIN = 'https://liveworkspace.app';
export const PREVIEWS_PATH = '/api/previews';
const SHARE_DOOR = /^\/api\/share\/([^/]+)\/(image\.svg|image\.png|card)$/;

/** The path on the previews service a request to `pathname` goes to, or null when it is not a preview. */
export function previewsTargetFor(pathname: string): string | null {
  if (underPrefix(pathname, PREVIEWS_PATH)) return pathname;
  const door = SHARE_DOOR.exec(pathname);
  return door ? `${PREVIEWS_PATH}/share/${door[1]}/${door[2]}` : null;
}

/**
 * A preview on an app's address: the same request at the previews service, minus this site's cookies. The bearer
 * token and the share headers go along (the index decides who may see an item's picture from them), and so does the
 * visitor's address. Null for a path that is not a preview, so the router carries on.
 */
export function routeToPreviews(
  request: Request,
  origin: string | undefined,
  doFetch: typeof fetch = fetch,
): Promise<Response> | null {
  const url = new URL(request.url);
  const path = previewsTargetFor(url.pathname);
  if (!path) return null;
  const target = new URL(`${path}${url.search}`, origin || PRODUCTION_PREVIEWS_ORIGIN);
  if (target.host === url.host) return Promise.resolve(loop('PREVIEWS_ORIGIN is this site'));
  const forwarded = new Request(target.toString(), request);
  forwarded.headers.delete('Cookie');
  const client = request.headers.get('CF-Connecting-IP');
  if (client) forwarded.headers.set(WORKSPACE_CLIENT_IP_HEADER, client);
  else forwarded.headers.delete(WORKSPACE_CLIENT_IP_HEADER);
  return doFetch(forwarded);
}
