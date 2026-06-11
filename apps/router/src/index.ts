// Routes URL paths to the right downstream app via service bindings.
// See specs/08-router-app.md.

export interface Env {
  MARKETING: Fetcher;
  LIVE: Fetcher;
  API: Fetcher;
  TELEMETRY: Fetcher;
}

const LIVE_PATH = '/live';
const API_PATH = '/api';
const TELEMETRY_PATH = '/telemetry';

// The live app's top-level page route segments. These serve at CLEAN
// URLs (no `/live` prefix) — the live worker's `out/` files are already
// `/live`-free — so the router forwards them to the live worker AS-IS,
// no strip. Marketing owns every other first segment (`/`,
// `/alternatives`, `/faq`, ...) and there's no overlap with this set.
// `/live/*` still exists ONLY for the bundled `_next` assets (the live
// app's prod `assetPrefix`), which ARE stripped — see isLivePath.
const LIVE_ROUTE_SEGMENTS = new Set([
  'diagram',
  'embed',
  'explorer',
  'get-started',
  'join',
  'new',
  'sign-in',
  'sso-callback',
]);

// Root-served live assets that don't ride the `assetPrefix` (Next's
// metadata icon). Routed to the live worker by exact path.
const LIVE_ROOT_ASSETS = new Set(['/icon.svg']);

function isLivePageRoute(pathname: string): boolean {
  if (LIVE_ROOT_ASSETS.has(pathname)) return true;
  const first = pathname.split('/')[1] ?? '';
  return LIVE_ROUTE_SEGMENTS.has(first);
}

function isLivePath(pathname: string): boolean {
  return pathname === LIVE_PATH || pathname.startsWith(`${LIVE_PATH}/`);
}

function isApiPath(pathname: string): boolean {
  return pathname === API_PATH || pathname.startsWith(`${API_PATH}/`);
}

function isTelemetryPath(pathname: string): boolean {
  return pathname === TELEMETRY_PATH || pathname.startsWith(`${TELEMETRY_PATH}/`);
}

// Forward to a basePath app, stripping the path prefix. Next.js's
// basePath rewrites the URLs in the emitted HTML/JS (so links + asset
// refs carry the prefix) but does NOT shift the file layout — files
// still live at the root of `out/`. So the router presents
// `/<prefix>/foo` to the downstream worker as `/foo`.
function forwardStripped(
  request: Request,
  url: URL,
  prefix: string,
  target: Fetcher,
): Response | Promise<Response> {
  const stripped = url.pathname.slice(prefix.length) || '/';
  const rewritten = new URL(url.toString());
  rewritten.pathname = stripped;
  return target.fetch(new Request(rewritten.toString(), request));
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    // /api/* is forwarded as-is to the api worker. The API worker handles
    // the full pathname (it expects `/api/...`) so there's no prefix
    // stripping here, unlike the basePath apps.
    if (isApiPath(url.pathname)) {
      return env.API.fetch(request);
    }
    // `/live/*` is now ONLY the live app's `_next` assets (its prod
    // `assetPrefix`). Strip the prefix and forward — the worker serves
    // them from `out/_next`.
    if (isLivePath(url.pathname)) {
      return forwardStripped(request, url, LIVE_PATH, env.LIVE);
    }
    if (isTelemetryPath(url.pathname)) {
      // The public transparency dashboard (spec/22), a basePath:'/telemetry'
      // static app — same prefix-strip as the live app's assets.
      return forwardStripped(request, url, TELEMETRY_PATH, env.TELEMETRY);
    }
    // Clean live-app page routes (/diagram, /explorer, /new, ...) and
    // its root-served icon: forwarded AS-IS (no strip — the worker's
    // files are already `/live`-free).
    if (isLivePageRoute(url.pathname)) {
      return env.LIVE.fetch(request);
    }
    return env.MARKETING.fetch(request);
  },
} satisfies ExportedHandler<Env>;
