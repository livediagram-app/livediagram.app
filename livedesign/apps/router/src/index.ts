// Routes URL paths to the right downstream app. In production each app is
// a service binding; in local dev (`wrangler dev --env local`) the bindings
// don't exist and each app is a plain HTTP origin to proxy instead.
// See docs/specs/016-platform/router-app.md.

import { applyCachePolicy } from './cache-policy';
import { LIVE_ROUTE_SEGMENTS } from '@livedesign/api-schema';
import { TELEMETRY_DASHBOARD_URL } from '@liveworkspace/telemetry';
import {
  routeToWorkspace,
  routeToPreviews,
  forwardToDrive,
  forwardToIndex,
  isDrivePath,
  PRODUCTION_DRIVE_ORIGIN,
  PRODUCTION_INDEX_ORIGIN,
  statusRedirect,
  wwwRedirect,
} from '@liveworkspace/sites/workspace-proxy';

export interface Env {
  // Production service bindings (absent in the `local` env).
  MARKETING?: Fetcher;
  LIVE?: Fetcher;
  API?: Fetcher;
  HELP?: Fetcher;
  // Local-dev origins (absent in production).
  MARKETING_ORIGIN?: string;
  LIVE_ORIGIN?: string;
  API_ORIGIN?: string;
  HELP_ORIGIN?: string;
  // Set to "staging" on the staging router only (docs/specs/016-platform/staging-environment.md). Marks every
  // response noindex so the public staging mirror can't compete with
  // production in search results. Absent in production and in local dev.
  DEPLOY_ENV?: string;
  // liveworkspace.app, whose pages this router serves under this app's address while the app's switch is on
  // (liveworkspace/docs/specs/004-index/one-explorer.md "The Explorer on each app's address"). Unset means production's; staging
  // and local dev name their own.
  WORKSPACE_ORIGIN?: string;
  // liveworkspace's previews (liveworkspace/docs/specs/006-media/previews.md): `/api/previews/*` and a share link's image.svg,
  // image.png and card go there, not to the api. Unset means production's.
  PREVIEWS_ORIGIN?: string;
  // The central telemetry dashboard /telemetry redirects to (liveworkspace/docs/specs/008-telemetry/telemetry.md): unset means
  // production's, staging and local dev name their own.
  TELEMETRY_DASHBOARD_URL?: string;
  // The central index (liveworkspace/docs/specs/004-index/one-explorer.md): `/api/index/*` goes there, not to the api. Unset means
  // production's; staging and local dev name their own.
  INDEX_ORIGIN?: string;
  // liveworkspace's Google Drive mirror (liveworkspace/docs/specs/005-drive/drive.md): `/api/drive/*` goes there, not to the api.
  // Unset means production's.
  DRIVE_ORIGIN?: string;
}

const LIVE_PATH = '/live';
const API_PATH = '/api';
const INDEX_PATH = '/api/index';
const TELEMETRY_PATH = '/telemetry';
const HELP_PATH = '/help';

// The live app's top-level page route segments. These serve at CLEAN
// URLs (no `/live` prefix) — the live worker's `out/` files are already
// `/live`-free — so the router forwards them to the live worker AS-IS,
// no strip. Marketing owns every other first segment (`/`,
// `/alternatives`, `/faq`, ...) and there's no overlap with this set.
// `/live/*` still exists ONLY for the bundled `_next` assets (the live
// app's `assetPrefix`), which ARE stripped in production — see isLivePath.
// The set is shared from api-schema so the telemetry dashboard's per-app
// page-view split (docs/specs/017-telemetry/page-view-telemetry.md) reads the same list this routes by.

// Root-served live assets that don't ride the `assetPrefix` (Next's
// metadata icon). Routed to the live worker by exact path.
const LIVE_ROOT_ASSETS = new Set(['/icon.svg']);

// Help-centre category slugs, which are the first segment of every help
// article path (`/canvas/shadows/`, `/palette/build/frames/`). The help app
// serves them all under `/help`, so a bare one is an article URL that lost
// its prefix — a hand-typed link, an old bookmark, a copy-paste that dropped
// the first segment. Those 404'd into marketing; they redirect now.
//
// The list is pinned to the registry's own categories by index.test.ts, so a
// new category cannot quietly stop redirecting. `explorer` is deliberately
// absent: the live app owns that segment (it is matched first either way).
const HELP_CATEGORY_SEGMENTS = new Set([
  'about',
  'account-and-data',
  'canvas',
  'collaboration',
  'contact',
  'developers',
  'getting-started',
  'pages',
  'palette',
  'policies',
  'privacy-and-security',
  'search-panel',
  'selection-modes',
  'supported-devices',
  'tabs',
  'tips-and-tricks',
  'tools',
  'troubleshooting',
  'user-interface',
]);

function isLivePageRoute(pathname: string): boolean {
  if (LIVE_ROOT_ASSETS.has(pathname)) return true;
  const first = pathname.split('/')[1] ?? '';
  return LIVE_ROUTE_SEGMENTS.has(first);
}

function hasPrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

// A stripped app's own redirect (its trailing-slash one: `/explorer/folders` to `/explorer/folders/`)
// names a path inside that app; relative to the host it would leave the app (`/help` lost, landing
// on the editor or a 404). Its prefix goes back on. Absolute and protocol-relative ones are left be.
export function withPrefixedRedirect(res: Response, prefix: string): Response {
  if (res.status < 300 || res.status >= 400) return res;
  const location = res.headers.get('Location');
  if (!location || !location.startsWith('/') || location.startsWith('//')) return res;
  if (hasPrefix(location.split(/[?#]/)[0]!, prefix)) return res;
  const headers = new Headers(res.headers);
  headers.set('Location', `${prefix}${location}`);
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
}

// Forward to a downstream app.
//
// Production (service binding): basePath/assetPrefix apps get `stripPrefix`
// — Next.js's prefix rewrites the URLs in the emitted HTML/JS but does NOT
// shift the file layout, so the deployed workers hold prefix-free `out/`
// files and the router presents `/<prefix>/foo` to them as `/foo`.
//
// Local dev (origin): swap the origin and keep the path UNstripped — the
// Next dev servers serve their own prefixes (basePath for help,
// the live app's `/live` assetPrefix, which applies in dev too).
function forward(
  request: Request,
  url: URL,
  binding: Fetcher | undefined,
  origin: string | undefined,
  stripPrefix?: string,
): Response | Promise<Response> {
  if (binding) {
    if (!stripPrefix) return binding.fetch(request);
    const rewritten = new URL(url.toString());
    rewritten.pathname = url.pathname.slice(stripPrefix.length) || '/';
    return binding
      .fetch(new Request(rewritten.toString(), request))
      .then((res) => withPrefixedRedirect(res, stripPrefix));
  }
  if (origin) {
    const target = new URL(origin);
    const rewritten = new URL(url.toString());
    rewritten.protocol = target.protocol;
    rewritten.host = target.host;
    return fetch(new Request(rewritten.toString(), request));
  }
  return new Response(
    `router: no service binding and no *_ORIGIN var for ${url.pathname} — ` +
      'run `wrangler dev --env local` locally, or check wrangler.toml.',
    { status: 503 },
  );
}

// Stamp `X-Robots-Tag: noindex, nofollow` on a staging response (docs/specs/016-platform/staging-environment.md).
//
// Staging is deliberately public — no auth wall, so a change can be shared
// with someone before it ships — which makes keeping it out of search results
// this header's job. Done once here rather than as a build flag threaded into
// five static apps: every app on the hostname passes through the router, the
// api's JSON included.
//
// A 101 is returned UNTOUCHED. The realtime room answers
// `/api/designs/<id>/ws` with a WebSocket upgrade, and a Response carrying a
// `webSocket` cannot be reconstructed — `new Response(body, res)` drops the
// socket and takes realtime collab down on staging alone, on one path, which
// is precisely the sort of breakage that survives a smoke test. Crawlers do
// not open WebSockets, so there is nothing to mark noindex here anyway.
function markNoIndex(response: Response): Response {
  if (response.status === 101 || response.webSocket) return response;
  const tagged = new Response(response.body, response);
  tagged.headers.set('X-Robots-Tag', 'noindex, nofollow');
  return tagged;
}

// The caching rules (docs/specs/016-platform/stale-builds.md "Caching rules"), for every site the
// router fronts: pages never stale, build assets immutable, a missing asset an honest 404. The api
// sets its own caching, so its responses pass as they are.
async function withCachePolicy(request: Request, env: Env): Promise<Response> {
  const { pathname } = new URL(request.url);
  const response = await route(request, env);
  if (hasPrefix(pathname, API_PATH)) return response;
  // Locally the router fronts `next dev`, whose chunks are not content-hashed (cache-policy.ts).
  return applyCachePolicy(response, pathname, { hashedAssets: env.DEPLOY_ENV !== 'local' });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (env.DEPLOY_ENV === 'staging') {
      return markNoIndex(await withCachePolicy(request, env));
    }
    return withCachePolicy(request, env);
  },
} satisfies ExportedHandler<Env>;

// The routing table itself. Split from `fetch` so the staging header wrapper
// has a single return value to decorate instead of nine.
async function route(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  // The status page is liveworkspace's now, one for every app (liveworkspace/docs/specs/010-site/site.md "Status"): an old link
  // lands on it at livedesign's group.
  const status = statusRedirect(url, 'livedesign', env.WORKSPACE_ORIGIN);
  if (status) return status;
  if (hasPrefix(url.pathname, TELEMETRY_PATH)) {
    // The public transparency dashboard (docs/specs/017-telemetry/telemetry.md) is liveworkspace's now, one
    // for every app: an old link lands on it with livedesign picked.
    return telemetryRedirect(env);
  }
  // The bare domain's pages live on www. (docs/specs/016-platform/router-app.md "The bare domain"): one 301, to
  // where this router's own redirects below would land. Only the redirects that leave the site come first. Production
  // only (no DEPLOY_ENV): `wrangler dev` hands the router its production host in request.url.
  const www = env.DEPLOY_ENV ? null : wwwRedirect(request, url, redirectedPath);
  if (www) return www;
  // liveworkspace's Explorer under this address, while livedesign's switch is on (@liveworkspace/sites/workspace-proxy):
  // `/explorer/*` and the account reads it makes, fetched from liveworkspace.app with the address bar unchanged.
  const workspace = routeToWorkspace(request, { app: 'livedesign', origin: env.WORKSPACE_ORIGIN });
  if (workspace) return workspace;
  // Every item's preview, and a share link's live image and card, are liveworkspace's (liveworkspace/docs/specs/006-media/previews.md).
  const preview = routeToPreviews(request, env.PREVIEWS_ORIGIN);
  if (preview) return preview;
  // The Explorer's own calls (liveworkspace/docs/specs/004-index/one-explorer-contracts.md): the index answers them, so the editor
  // reaches it on its own origin with no CORS preflight. Path and query kept, Authorization passed through.
  if (hasPrefix(url.pathname, INDEX_PATH)) {
    return forwardToIndex(request, url, env.INDEX_ORIGIN || PRODUCTION_INDEX_ORIGIN);
  }
  // Cloud Sync and the Explorer's sync marks (liveworkspace/docs/specs/005-drive/drive.md): the Drive mirror answers them, cookies
  // dropped.
  if (isDrivePath(url.pathname)) {
    return forwardToDrive(request, url, env.DRIVE_ORIGIN || PRODUCTION_DRIVE_ORIGIN);
  }
  // /api/* is forwarded as-is to the api worker. The API worker handles
  // the full pathname (it expects `/api/...`) so there's no prefix
  // stripping here, unlike the basePath apps.
  if (hasPrefix(url.pathname, API_PATH)) {
    return forward(request, url, env.API, env.API_ORIGIN);
  }
  // `/live/*` is ONLY the live app's `_next` assets (its `assetPrefix`).
  // Stripped in production — the worker serves them from `out/_next`.
  if (hasPrefix(url.pathname, LIVE_PATH)) {
    return forward(request, url, env.LIVE, env.LIVE_ORIGIN, LIVE_PATH);
  }
  if (hasPrefix(url.pathname, HELP_PATH)) {
    // The help centre (docs/specs/018-help/help-app.md), a basePath:'/help' static app — same
    // prefix-strip as the live app's assets.
    return forward(request, url, env.HELP, env.HELP_ORIGIN, HELP_PATH);
  }
  // Clean live-app page routes (/design, /explorer, /new, ...) and
  // its root-served icon: forwarded AS-IS (no strip — the worker's
  // files are already `/live`-free).
  if (isLivePageRoute(url.pathname)) {
    return forward(request, url, env.LIVE, env.LIVE_ORIGIN);
  }
  // A help article URL that lost its `/help` prefix. Sent on with a
  // permanent redirect rather than dropped into marketing's 404: the path
  // is unambiguous, and these are links people have already shared.
  const helpPath = helpCategoryPath(url.pathname);
  if (helpPath) {
    url.pathname = helpPath;
    return Response.redirect(url.toString(), 308);
  }
  return forward(request, url, env.MARKETING, env.MARKETING_ORIGIN);
}

// Where this router's own redirects send `url`'s path, or null where none would: the bare domain's one hop lands
// there (wwwRedirect), so it is never followed by a second.
function redirectedPath(url: URL): string | null {
  return helpCategoryPath(url.pathname);
}

// A help article's path that lost its `/help` prefix, with the prefix put back; null for any other path, a live
// page route's included.
function helpCategoryPath(pathname: string): string | null {
  if (isLivePageRoute(pathname) || !HELP_CATEGORY_SEGMENTS.has(pathname.split('/')[1] ?? ''))
    return null;
  return `${HELP_PATH}${pathname}`;
}

// Where /telemetry and everything under it now lives: the central dashboard, filtered to livedesign.
export function telemetryRedirect(env: Env): Response {
  const target = new URL(env.TELEMETRY_DASHBOARD_URL || TELEMETRY_DASHBOARD_URL);
  target.searchParams.set('app', 'livedesign.app');
  // Built by hand: Response.redirect's headers are immutable, and the caching rules still stamp this one.
  return new Response(null, { status: 301, headers: { Location: target.toString() } });
}
