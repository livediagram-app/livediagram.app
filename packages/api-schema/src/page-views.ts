// Page view telemetry (docs/specs/017-telemetry/page-view-telemetry.md): which page a `Page·View` event names, and
// which app serves it. The normaliser and the validator live together so the
// browser can never produce a path the ingest would drop, and the app
// classifier shares the router's own segment list so the dashboard and the
// router can't disagree about who serves a path.

// The live app's top-level page route segments. These serve at clean URLs
// (`/document`, `/explorer`, ...), and the router forwards them to the live
// worker (docs/specs/016-platform/router-app.md). Marketing owns every other first segment.
export const LIVE_ROUTE_SEGMENTS: ReadonlySet<string> = new Set([
  'document',
  // The Google Drive mirror's /drive/connected and /drive/open
  // (docs/specs/022-drive-mirror/drive-mirror.md).
  'drive',
  'embed',
  'explorer',
  'get-started',
  'join',
  'new',
  'oauth',
  'sign-in',
  'sso-callback',
  // The workbench pairing page, /workbench/pair (docs/specs/013-workspace/workbench-embeds.md "Pairing").
  'workbench',
]);

// Named after the apps (`apps/live` is the editor).
export type PageViewApp = 'Marketing' | 'Live' | 'Help' | 'Dashboard' | 'Community';

const SEGMENT = /^[a-z0-9._-]{1,60}$/;
const MAX_SEGMENTS = 6;
const MAX_LENGTH = 120;

// What the ingest accepts as a `Page·View` type: `/`, or up to six
// `/`-separated segments of safe characters. There is no id placeholder:
// an id is dropped, never stood in for, so nothing id-shaped is stored.
export const PAGE_VIEW_PATH_PATTERN = /^\/$|^(?:\/[a-z0-9._-]{1,60}){1,6}$/;

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
 * An id, and everything after it, is dropped: what follows an id is about
 * that one thing, not a different page. So every document is `/document`.
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
  let segments = raw
    .toLowerCase()
    .split('/')
    .filter((s) => s !== '');
  // Every `/document/...` URL is the editor on one document (docs/specs/007-editor/new-document-route.md), and
  // whatever follows the segment is the document's id.
  if (segments[0] === 'document') segments = ['document'];
  const last = segments[segments.length - 1];
  if (last === 'index.html') segments.pop();
  else if (last?.endsWith('.html')) segments[segments.length - 1] = last.slice(0, -5);
  if (segments.length > MAX_SEGMENTS) return null;
  const out: string[] = [];
  for (const segment of segments) {
    if (!SEGMENT.test(segment)) return null;
    if (looksLikeId(segment)) break;
    out.push(segment);
  }
  // A path that is nothing but an id isn't a page anyone navigated to.
  if (out.length === 0 && segments.length > 0) return null;
  const path = `/${out.join('/')}`;
  return isValidPageViewPath(path) ? path : null;
}

// The first path segments another app serves; every other path is a marketing page.
const APP_SEGMENTS: ReadonlyMap<string, PageViewApp> = new Map<string, PageViewApp>([
  ['help', 'Help'],
  ['telemetry', 'Dashboard'],
  ['community', 'Community'],
  ...[...LIVE_ROUTE_SEGMENTS].map((segment): [string, PageViewApp] => [segment, 'Live']),
]);

/** First path segments served by an app other than marketing. */
export const NON_MARKETING_SEGMENTS: readonly string[] = [...APP_SEGMENTS.keys()];

/** Which app serves a normalised page path (the router's routing, docs/specs/016-platform/router-app.md). */
export function pageViewApp(path: string): PageViewApp {
  return APP_SEGMENTS.get(path.split('/')[1] ?? '') ?? 'Marketing';
}
