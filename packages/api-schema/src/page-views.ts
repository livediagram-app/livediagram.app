// Page view telemetry (spec/150): which page a `Page·View` event names, and
// which app serves it. The normaliser and the validator live together so the
// browser can never produce a path the ingest would drop, and the app
// classifier shares the router's own segment list so the dashboard and the
// router can't disagree about who serves a path.

// The live app's top-level page route segments. These serve at clean URLs
// (`/diagram`, `/explorer`, ...), and the router forwards them to the live
// worker (spec/08). Marketing owns every other first segment.
export const LIVE_ROUTE_SEGMENTS: ReadonlySet<string> = new Set([
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

export type PageViewApp = 'Marketing' | 'Editor' | 'Help' | 'Dashboard';

// The one placeholder a segment can be replaced with.
const ID = '[id]';
const SEGMENT = /^[a-z0-9._-]{1,60}$/;
const MAX_SEGMENTS = 6;
const MAX_LENGTH = 120;

// What the ingest accepts as a `Page·View` type: `/`, or up to six
// `/`-separated segments of safe characters or the `[id]` placeholder.
export const PAGE_VIEW_PATH_PATTERN = /^\/$|^(?:\/(?:[a-z0-9._-]{1,60}|\[id\])){1,6}$/;

export function isValidPageViewPath(value: string): boolean {
  return value.length <= MAX_LENGTH && PAGE_VIEW_PATH_PATTERN.test(value);
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

// A segment that names a thing rather than a page: a UUID, or a long token
// with a digit in it. Slugs (`the-canvas`, `miro`) are neither.
function looksLikeId(segment: string): boolean {
  return UUID.test(segment) || (segment.length >= 16 && /\d/.test(segment));
}

/**
 * Reduce a browser pathname to the page it is, for a `Page·View` event.
 * Returns null when the path can't be expressed safely: deny-by-default, so
 * an odd path is lost rather than leaked. The query string and hash are never
 * part of a pathname, so they cannot reach here.
 */
export function pageViewPath(pathname: string): string | null {
  let raw: string;
  try {
    raw = decodeURIComponent(pathname);
  } catch {
    return null;
  }
  const segments = raw
    .toLowerCase()
    .split('/')
    .filter((s) => s !== '');
  const last = segments[segments.length - 1];
  if (last === 'index.html') segments.pop();
  else if (last?.endsWith('.html')) segments[segments.length - 1] = last.slice(0, -5);
  if (segments.length === 0) return '/';
  if (segments.length > MAX_SEGMENTS) return null;
  const out: string[] = [];
  for (const [i, segment] of segments.entries()) {
    // Every `/diagram/...` URL is the editor on one diagram.
    if (i === 1 && segments[0] === 'diagram') {
      out.push(ID);
      break;
    }
    if (!SEGMENT.test(segment)) return null;
    out.push(looksLikeId(segment) ? ID : segment);
  }
  const path = `/${out.join('/')}`;
  return isValidPageViewPath(path) ? path : null;
}

/** Which app serves a normalised page path (the router's routing, spec/08). */
export function pageViewApp(path: string): PageViewApp {
  const first = path.split('/')[1] ?? '';
  if (first === 'help') return 'Help';
  if (first === 'telemetry') return 'Dashboard';
  if (LIVE_ROUTE_SEGMENTS.has(first)) return 'Editor';
  return 'Marketing';
}
