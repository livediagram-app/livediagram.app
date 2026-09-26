// Error telemetry tokens (docs/specs/017-telemetry/telemetry.md 'Error' category): how every error source
// says WHERE it failed inside the one `type` token it has. Shared so the
// editor, the help centre, the api worker and the MCP worker all build the
// same shape: dot-separated PascalCase parts, `<What>.<Where>[.<Which>]`,
// e.g. `Http403.SaveTab`, `Internal.Put.Diagrams.Tabs`,
// `Uncaught.Diagram.TypeError`, `Render.Canvas.TypeError`.
//
// Every part a caller passes must already be a preset (a request intent
// authored in code, a route word from a closed list, a page from
// pageViewPath). These helpers only normalise the spelling; they do not make
// arbitrary text safe, which is why nothing here accepts a message, a stack,
// or a raw URL.

import { TELEMETRY_TYPE_PATTERN } from './telemetry-schema';

// TELEMETRY_TYPE_PATTERN's length cap. A token longer than this would be
// rejected at ingest and silently dropped, so errorTypeToken trims to fit.
const MAX_TYPE_LENGTH = 40;

/**
 * One word-ish string ('save tab', 'room-ticket', 'find_diagrams') as a
 * PascalCase token ('SaveTab', 'RoomTicket', 'FindDiagrams'). Anything that
 * isn't a letter or digit is a word break and is dropped, so a path, id
 * separator, or colon can't reach the wire.
 */
export function pascalToken(value: string): string {
  return value
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)
    .map((w) => w[0]!.toUpperCase() + w.slice(1))
    .join('');
}

/**
 * Join already-safe parts into one error `type`: each dot-separated part PascalCased,
 * empties skipped, joined with '.' (TELEMETRY_TYPE_PATTERN rejects a colon,
 * so the dot is load-bearing) and capped at the pattern's 40 characters.
 * The first part is the kind, so it always survives the cap.
 */
export function errorTypeToken(...parts: Array<string | null | undefined>): string {
  // A part may itself be dotted (an apiRouteLabel), so it keeps its dots.
  const token = parts
    .flatMap((p) => (p ? p.split('.') : []))
    .map(pascalToken)
    .filter(Boolean)
    .join('.')
    .slice(0, MAX_TYPE_LENGTH)
    .replace(/\.$/, '');
  return TELEMETRY_TYPE_PATTERN.test(token) ? token : 'Unknown';
}

// The error constructors worth telling apart. Closed on purpose: an error's
// `name` is just a string any library (or a thrown object) can set, so only
// these reach the wire and everything else reads as `Other`. `ChunkLoadError`
// is the one that isn't built in: a stale tab asking for a bundle chunk the
// last deploy removed, which is a deploy problem, not a code bug.
const KNOWN_ERROR_NAMES: ReadonlySet<string> = new Set([
  'Error',
  'TypeError',
  'RangeError',
  'ReferenceError',
  'SyntaxError',
  'EvalError',
  'URIError',
  'AggregateError',
  'ChunkLoadError',
  'AbortError',
  'TimeoutError',
  'NetworkError',
  'NotAllowedError',
  'NotFoundError',
  'NotSupportedError',
  'InvalidStateError',
  'SecurityError',
  'QuotaExceededError',
  'DataCloneError',
  'DataError',
]);

/**
 * What kind of thing was thrown: a known error constructor name, `NonError`
 * when the value wasn't an Error at all (`throw 'x'`, `reject(undefined)`),
 * or `Other` for an Error subclass outside the closed list.
 */
export function errorNameToken(thrown: unknown): string {
  if (!(thrown instanceof Error)) return 'NonError';
  return KNOWN_ERROR_NAMES.has(thrown.name) ? thrown.name : 'Other';
}

/**
 * The page part of a client error: the first segment of a normalised page
 * path (docs/specs/017-telemetry/page-view-telemetry.md pageViewPath output, so ids are already gone), e.g.
 * '/diagram' -> 'Diagram', '/explorer/team' -> 'Explorer', '/' -> 'Home',
 * '/help/canvas' -> 'Help'. Null when the path couldn't be normalised.
 */
export function errorPageToken(pagePath: string | null): string | null {
  if (pagePath === null) return null;
  const first = pagePath.split('/')[1] ?? '';
  return first === '' ? 'Home' : pascalToken(first) || null;
}

// The api's top-level resources: the segment after `/api` that the worker
// dispatches on (apps/api/src/index.ts, whose test keeps the two in step).
export const API_ROUTE_RESOURCES: ReadonlySet<string> = new Set([
  'capabilities',
  'openapi.json',
  'unfurl',
  'ai',
  'events',
  'telemetry',
  'share',
  'shared',
  'images',
  'diagrams',
  'folders',
  'custom-themes',
  'teams',
  'tokens',
  'oauth',
  'account',
  'favourites',
  'timeline',
  'activity',
  'preferences',
  'migrate',
  'guest-id',
  'participants',
]);

// The fixed words that appear BELOW a resource in the api's routes
// (`/diagrams/<id>/tabs/<tabId>/comments`). Only these survive into a route
// label; every other segment is an id, a share code, or a slug and is
// skipped. Closed on purpose so a label can never carry an identifier.
const API_ROUTE_WORDS: ReadonlySet<string> = new Set([
  'tabs',
  'share',
  'members',
  'log',
  'comments',
  'room-ticket',
  'invite-link',
  'events',
  'link',
  'extend',
  'accept',
  'tab',
  'join',
  'ws',
  'thumbnail',
  'share-password',
  'notify-action',
  'library',
  'folder',
  'dismiss',
  'copy',
  'access-check',
  'usage',
  'unread',
  'summary',
  'refresh',
  'invites',
]);

/**
 * Which endpoint a request hit, as a label with no identifiers in it:
 * `PUT /api/diagrams/<id>/tabs/<tabId>` -> `Put.Diagrams.Tabs`. Takes any URL
 * or path containing an `/api/` segment (absolute or relative, query ignored).
 * An unknown resource reads `Unknown` rather than being echoed.
 */
export function apiRouteLabel(method: string, url: string): string {
  let pathname: string;
  try {
    pathname = new URL(url, 'http://route.invalid').pathname;
  } catch {
    pathname = '';
  }
  const segments = pathname.split('/').filter(Boolean);
  const at = segments.indexOf('api');
  const rest = at === -1 ? [] : segments.slice(at + 1);
  const resource = rest[0];
  const verb = pascalToken(method.toLowerCase());
  if (!resource || !API_ROUTE_RESOURCES.has(resource)) return `${verb}.Unknown`;
  const words = rest.slice(1).filter((s) => API_ROUTE_WORDS.has(s));
  return [verb, resource, ...words].map(pascalToken).join('.');
}
