// The one help centre's Worker, its logic (liveworkspace/docs/specs/016-help/blueprints/help-centre.md "The Worker"):
// which scope a request is for, and what it answers. A module of its own so it is tested without a Worker runtime;
// src/worker.ts is the entry and exports only its default handler.
import {
  INERT_PARSE_POLICY,
  MARKUP_POLICY,
  NEXTJS_POLICY,
  PROSEMIRROR_CLIPBOARD_POLICY,
  trustedTypesCsp,
} from '@liveworkspace/trusted-types/csp';

export const HELP_SCOPES = [
  'livediagram',
  'liveplanner',
  'livedocuments',
  'livedesign',
  'livehuddle',
  'all',
] as const;
export type Scope = (typeof HELP_SCOPES)[number];
export type App = Exclude<Scope, 'all'>;

/** The header an app's router sends on the help forward, naming its app. */
export const HELP_APP_HEADER = 'x-help-app';

/** dist/manifest.json, written by scripts/build-scopes.mjs from the catalogue. */
export interface HelpManifest {
  /** Every article path (`tabs/using-tabs`) and the apps it applies to. */
  articles: Record<string, App[]>;
  /** Every category landing (`tabs`) and the apps whose articles it holds. */
  categories: Record<string, App[]>;
  /** The redirect map (the registry's HELP_REDIRECTS): `from` may end in `/*`; `to` '' is the help home. */
  redirects: { from: string; to: string; apps?: App[] }[];
  /** Each scope's origin, for absolute 308s to an article's canonical address. */
  origins: Record<Scope, string>;
}

const APPS = new Set<string>(HELP_SCOPES.filter((s) => s !== 'all'));

/** The request's scope: the app its router names, else All Apps (liveworkspace.app's own routes). */
export function scopeOf(request: Request): Scope {
  const named = request.headers.get(HELP_APP_HEADER)?.trim().toLowerCase();
  return named && APPS.has(named) ? (named as App) : 'all';
}

/** The path inside the help centre, with a leading slash: liveworkspace.app's routes keep `/help`, an app's router
 *  strips it. */
export function helpPath(pathname: string): string {
  if (pathname === '/help') return '/';
  return pathname.startsWith('/help/') ? pathname.slice('/help'.length) : pathname;
}

/** `/tabs/using-tabs/` → `tabs/using-tabs`, the manifest's key. */
export const routeKey = (path: string) => path.replace(/^\/+|\/+$/g, '');

/** The redirect for `route` in `scope`, exact paths before prefixes, an app-limited one only on its apps. */
export function redirectOf(
  manifest: HelpManifest,
  route: string,
  scope: Scope,
): HelpManifest['redirects'][number] | undefined {
  const holds = (r: HelpManifest['redirects'][number]) =>
    !r.apps || scope === 'all' || r.apps.includes(scope);
  const exact = manifest.redirects.find((r) => r.from === route && holds(r));
  if (exact) return exact;
  return manifest.redirects.find(
    (r) => r.from.endsWith('/*') && route.startsWith(r.from.slice(0, -1)) && holds(r),
  );
}

/** Where an article (or category) for `apps` is canonical: its one app's address, or All Apps for several. */
export function canonicalScopeOf(apps: readonly App[]): Scope {
  return apps.length === 1 ? apps[0]! : 'all';
}

/** Whether a request is for staging (staging.<site>): its canonical 308s stay on staging. */
export const isStagingHost = (host: string) => host.toLowerCase().startsWith('staging.');

/** A redirect's Location: an absolute `to` as it is, else the path on this address with a trailing slash, the query,
 *  then any `#fragment` the map names. */
export function movedLocation(to: string, prefix: string, search: string): string {
  if (/^https:\/\//.test(to)) return to;
  const [path = '', fragment] = to.split('#');
  return `${prefix}${path ? `/${path}/` : '/'}${search}${fragment ? `#${fragment}` : ''}`;
}

export type Answer = { kind: 'redirect'; location: string } | { kind: 'asset'; path: string };

/**
 * What the Worker answers for `pathname` in `scope`: a 308 for a moved path (on the same address, the router puts
 * `/help` back on a relative Location for an app; liveworkspace.app keeps the prefix), a 308 to the canonical
 * address for an article or category that does not apply to the scope, else the scope's file.
 */
export function answer(
  manifest: HelpManifest,
  scope: Scope,
  pathname: string,
  search: string,
  { staging = false }: { staging?: boolean } = {},
): Answer {
  const path = helpPath(pathname);
  const route = routeKey(path);
  const prefix = scope === 'all' ? '/help' : '';
  const moved = route ? redirectOf(manifest, route, scope) : undefined;
  if (moved) return { kind: 'redirect', location: movedLocation(moved.to, prefix, search) };
  const apps = manifest.articles[route] ?? manifest.categories[route];
  if (apps && apps.length > 0 && scope !== 'all' && !apps.includes(scope)) {
    const origin = manifest.origins[canonicalScopeOf(apps)];
    // A staging page's canonical copy is on staging too (staging.<site>).
    const base = staging ? origin.replace(/^https:\/\/(?:www\.)?/, 'https://staging.') : origin;
    return { kind: 'redirect', location: `${base}/help/${route}/${search}` };
  }
  return { kind: 'asset', path: `/${scope}${path}` };
}

/** The headers every help response carries, as each product's help sent them from its _headers file. */
export const SECURITY_HEADERS: Readonly<Record<string, string>> = {
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy':
    'camera=(), microphone=(), geolocation=(), payment=(), usb=(), fullscreen=()',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'Content-Security-Policy': trustedTypesCsp([
    MARKUP_POLICY,
    INERT_PARSE_POLICY,
    NEXTJS_POLICY,
    PROSEMIRROR_CLIPBOARD_POLICY,
  ]),
};

/** `response` with the security headers set, and `Vary: x-help-app` so a cache keeps the scopes apart. */
export function withHelpHeaders(response: Response): Response {
  const out = new Response(response.body, response);
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) out.headers.set(name, value);
  out.headers.append('Vary', HELP_APP_HEADER);
  return out;
}
