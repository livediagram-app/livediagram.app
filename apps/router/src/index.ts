// Routes URL paths to the right downstream app. In production each app is
// a service binding; in local dev (`wrangler dev --env local`) the bindings
// don't exist and each app is a plain HTTP origin to proxy instead.
// See specs/08-router-app.md.

export interface Env {
  // Production service bindings (absent in the `local` env).
  MARKETING?: Fetcher;
  LIVE?: Fetcher;
  API?: Fetcher;
  TELEMETRY?: Fetcher;
  HELP?: Fetcher;
  // Local-dev origins (absent in production).
  MARKETING_ORIGIN?: string;
  LIVE_ORIGIN?: string;
  API_ORIGIN?: string;
  TELEMETRY_ORIGIN?: string;
  HELP_ORIGIN?: string;
}

const LIVE_PATH = '/live';
const API_PATH = '/api';
const TELEMETRY_PATH = '/telemetry';
const HELP_PATH = '/help';

// The live app's top-level page route segments. These serve at CLEAN
// URLs (no `/live` prefix) — the live worker's `out/` files are already
// `/live`-free — so the router forwards them to the live worker AS-IS,
// no strip. Marketing owns every other first segment (`/`,
// `/alternatives`, `/faq`, ...) and there's no overlap with this set.
// `/live/*` still exists ONLY for the bundled `_next` assets (the live
// app's `assetPrefix`), which ARE stripped in production — see isLivePath.
const LIVE_ROUTE_SEGMENTS = new Set([
  'diagram',
  'embed',
  'explorer',
  'get-started',
  'join',
  'new',
  'oauth',
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

function hasPrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

// Forward to a downstream app.
//
// Production (service binding): basePath/assetPrefix apps get `stripPrefix`
// — Next.js's prefix rewrites the URLs in the emitted HTML/JS but does NOT
// shift the file layout, so the deployed workers hold prefix-free `out/`
// files and the router presents `/<prefix>/foo` to them as `/foo`.
//
// Local dev (origin): swap the origin and keep the path UNstripped — the
// Next dev servers serve their own prefixes (basePath for telemetry/help,
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
    return binding.fetch(new Request(rewritten.toString(), request));
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

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
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
    if (hasPrefix(url.pathname, TELEMETRY_PATH)) {
      // The public transparency dashboard (spec/22), a basePath:'/telemetry'
      // static app — same prefix-strip as the live app's assets.
      return forward(request, url, env.TELEMETRY, env.TELEMETRY_ORIGIN, TELEMETRY_PATH);
    }
    if (hasPrefix(url.pathname, HELP_PATH)) {
      // The help centre (spec/55), a basePath:'/help' static app — same
      // prefix-strip as telemetry.
      return forward(request, url, env.HELP, env.HELP_ORIGIN, HELP_PATH);
    }
    // Clean live-app page routes (/diagram, /explorer, /new, ...) and
    // its root-served icon: forwarded AS-IS (no strip — the worker's
    // files are already `/live`-free).
    if (isLivePageRoute(url.pathname)) {
      return forward(request, url, env.LIVE, env.LIVE_ORIGIN);
    }
    return forward(request, url, env.MARKETING, env.MARKETING_ORIGIN);
  },
} satisfies ExportedHandler<Env>;
