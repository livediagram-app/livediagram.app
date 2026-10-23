// liveworkspace pages served under an app's own address (liveworkspace/docs/one-explorer.md "The Explorer on
// each app's address"). An app's router answers some paths by fetching them from liveworkspace.app, so the
// address bar keeps the app's name: `liveplanner.app/explorer/recent` shows the Explorer the site builds once,
// with liveplanner's session, offline items and colours. Every app's router uses this one helper, so turning it on
// for another app is one flag here and one route line in that app's router.
//
// Kept dependency-free and Worker-safe (fetch, URL, Headers only): it runs inside each app's router.

import type { AppName } from './index';

/** Where liveworkspace.app lives when the router names no other (`WORKSPACE_ORIGIN`). */
export const PRODUCTION_WORKSPACE_ORIGIN = 'https://liveworkspace.app';

// Set on every request a router forwards, naming the app. A request that already carries it was forwarded once,
// so a router that finds it refuses rather than forward again: a misconfigured origin can never loop.
export const WORKSPACE_PROXY_HEADER = 'X-Liveworkspace-Proxy';

// ---------- The per-app switch ------------------------------------------------------------------------------------
// Whether the app serves liveworkspace's Explorer at its own /explorer. An app turns it on once its items are on
// the index and the Explorer holds everything its own did (scratchpad's index-app kit notes say how). Off, the app's
// router leaves /explorer to the app's own editor as before.
export const EXPLORER_ON_APP_ORIGIN: Record<AppName, boolean> = {
  livediagram: false,
  liveplanner: true,
  livedocuments: false,
  livedesign: true,
};

// ---------- What is forwarded ---------------------------------------------------------------------------------------

export type WorkspaceRoute = {
  // The path on the app's origin: matched as itself, anything under it (`/`), or a file beside it (`.txt`, the
  // static export's RSC payload for that very page).
  prefix: string;
  // The same place on liveworkspace.app; usually the prefix itself.
  target: string;
  // Cookies belong to the origin that set them. `drop`: the app's cookies never leave for liveworkspace, and
  // liveworkspace's never land on the app's origin. `pass`: a page whose session is meant to live on the app's
  // origin (a proxied sign-in, say) keeps both ways.
  cookies: 'drop' | 'pass';
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

/** The routes an app's router forwards to liveworkspace.app: the Explorer's, while the app's switch is on. */
export function workspaceRoutes(app: AppName): readonly WorkspaceRoute[] {
  return EXPLORER_ON_APP_ORIGIN[app] ? [EXPLORER_ROUTE, ACCOUNT_ROUTE] : [];
}

function underPrefix(pathname: string, prefix: string): boolean {
  if (pathname === prefix) return true;
  if (!pathname.startsWith(prefix)) return false;
  const next = pathname.charAt(prefix.length);
  return next === '/' || next === '.';
}

/** The route a path falls under, or null. */
export function workspaceRouteFor(
  pathname: string,
  routes: readonly WorkspaceRoute[],
): WorkspaceRoute | null {
  return routes.find((route) => underPrefix(pathname, route.prefix)) ?? null;
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
  const route = workspaceRouteFor(url.pathname, routes);
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
  headers.set(WORKSPACE_PROXY_HEADER, options.app);
  headers.set('X-Forwarded-Host', url.host);
  // Built from the request itself, so its method and body come along as they are.
  const forwarded = new Request(new Request(target.toString(), request), {
    headers,
    redirect: 'manual',
  });
  const response = await (options.fetch ?? fetch)(forwarded);

  const location = response.headers.get('Location');
  const dropCookies = route.cookies === 'drop' && response.headers.has('Set-Cookie');
  if (!location && !dropCookies) return response;
  const out = new Headers(response.headers);
  if (location) out.set('Location', locationOnApp(location, origin, routes));
  if (dropCookies) out.delete('Set-Cookie');
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: out,
  });
}
