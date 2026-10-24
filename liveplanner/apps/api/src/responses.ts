// HTTP response helpers shared across the worker's route handlers.
// Lifted out of index.ts so the handler file can focus on routing +
// auth + business logic, and so the response shapes (status codes,
// error-body envelope, CORS preflight header set) have a single
// canonical home that the next route can grep for.

import {
  BUILD_ID_HEADER,
  CHANGESET_SEEN_HEADER,
  CLIENT_HEADER,
  INDEX_GRANT_HEADER,
  PROJECT_CONVERSION_HEADER,
  PROJECT_FORMAT_HEADER,
  PROJECT_TRASHED_ERROR,
} from '@liveplanner/api-schema';

// CORS for the browser. Editor app runs at the same hostname as the
// API (router worker stitches them together) so this is mostly a
// safety net for local dev where origins may differ. Headers list
// is the minimum the editor app sends today.
export const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  // `Authorization` carries the account access token (Stage 2 hybrid
  // auth, docs/specs/014-identity/auth-and-guest-access.md, docs/specs/015-api/api.md). Without it in the allow-list every
  // signed-in cross-origin request fails the preflight and surfaces
  // to JS as "Failed to fetch", which was hiding behind DELETE
  // /api/account and any other authed call from localhost:3202 to
  // localhost:8887 in dev.
  // The browser rejects a preflight if any header the client sends isn't
  // in this list, which surfaces as "Failed to fetch" with no other
  // signal, so each new header has to land here too. Take Offline and Sync
  // Diagram declare themselves with PROJECT_CONVERSION_HEADER.
  'Access-Control-Allow-Headers': `Authorization, Content-Type, ${INDEX_GRANT_HEADER}, X-Share-Code, X-Share-Password, X-Allow-Empty, X-Room-Cursor, ${PROJECT_CONVERSION_HEADER}, ${CHANGESET_SEEN_HEADER}, ${CLIENT_HEADER}`,
  'Access-Control-Max-Age': '86400',
  // The server release signal (docs/specs/016-platform/new-version-prompt.md, stale-builds.md), readable
  // by an editor on another origin (local dev, a deployment with a separate api host).
  // The tab revision as an ETag (docs/specs/024-agents/agent-changesets.md).
  'Access-Control-Expose-Headers': `${PROJECT_FORMAT_HEADER}, ${BUILD_ID_HEADER}, ETag`,
};

// An answer is the caller's live state, so a browser asks again before reusing it unless the route
// chooses a policy: Chromium keeps a 410 with no explicit expiry indefinitely, so a cached "deleted"
// would outlive the restore (docs/specs/015-api/api.md, "Caching"). `no-cache`, not `no-store`: a
// stored answer is drained by the cache even when its caller never reads the body.
export function json(body: unknown, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers);
  headers.set('Content-Type', 'application/json');
  if (!headers.has('Cache-Control')) headers.set('Cache-Control', 'no-cache');
  for (const [k, v] of Object.entries(CORS_HEADERS)) headers.set(k, v);
  return new Response(JSON.stringify(body), { ...init, headers });
}

// A text body with the JSON helper's CORS and caching (docs/specs/024-agents/project-views.md): a
// project view, which an agent reads as plain text.
export function textPlain(body: string, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers);
  headers.set('Content-Type', 'text/plain; charset=utf-8');
  if (!headers.has('Cache-Control')) headers.set('Cache-Control', 'no-cache');
  for (const [k, v] of Object.entries(CORS_HEADERS)) headers.set(k, v);
  return new Response(body, { ...init, headers });
}

export function notFound(): Response {
  return json({ error: 'not_found' }, { status: 404 });
}

// An SVG image body (a tab drawn on request, routes/tab-render-route.ts). Same CORS treatment as `json` so the
// editor app's blob-URL fetch works cross-origin in dev; the caller picks the `Cache-Control`.
const SVG_CSP =
  "default-src 'none'; style-src 'unsafe-inline' https://fonts.googleapis.com; " +
  'font-src https://fonts.gstatic.com; img-src data:; sandbox';

export function svgImage(body: string, cacheControl: string): Response {
  const headers = new Headers(CORS_HEADERS);
  headers.set('Content-Type', 'image/svg+xml; charset=utf-8');
  headers.set('Cache-Control', cacheControl);
  // Served on the app's own origin, so opened directly an SVG is a project
  // that could run script. The renderer escapes everything it writes; this
  // keeps a future slip there from becoming stored XSS. Fonts and inline
  // data images (what a snapshot actually uses) still load.
  headers.set('Content-Security-Policy', SVG_CSP);
  headers.set('X-Content-Type-Options', 'nosniff');
  return new Response(body, { headers });
}

// 204 No Content with the CORS header set. The canonical reply for a
// successful write that returns no body (DELETE, folder assignment,
// etc.); replaces the `new Response(null, { status: 204, headers:
// CORS_HEADERS })` literal that recurred across the route handlers.
export function noContent(): Response {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export function badRequest(msg: string): Response {
  return json({ error: 'bad_request', message: msg }, { status: 400 });
}

// 403 with the canonical `forbidden` token by default. Pass a `reason`
// to name the specific rule that fired (e.g. `admin_required`,
// `not_your_invite`) while keeping the 403 envelope uniform — the
// client reads the `error` token to branch. Tokens are snake_case to
// match every other error in this file.
export function forbidden(reason = 'forbidden'): Response {
  return json({ error: reason }, { status: 403 });
}

// 405 for a known route hit with the wrong method. Canonical home for
// the `{ error: 'method_not_allowed' }` literal that several routes
// (capabilities, ai) had inlined.
export function methodNotAllowed(): Response {
  return json({ error: 'method_not_allowed' }, { status: 405 });
}

// 413 for a body over a route's size cap. Canonical home for the
// `{ error: 'payload_too_large' }` literal the body gate in index.ts and the
// per-field / per-tab caps in the project and tab routes share.
export function payloadTooLarge(): Response {
  return json({ error: 'payload_too_large' }, { status: 413 });
}

export function rateLimited(): Response {
  return json({ error: 'rate_limited' }, { status: 429 });
}

// signed-in only surfaces (teams, docs/specs/013-workspace/teams.md). Unlike missingAuth() below —
// which names both identity sources because either is acceptable —
// this is for endpoints a guest token cannot use (membership is keyed by account id +
// verified email), so the only fix is signing in. 401 rather than 400
// so the client can branch to its "sign in to use teams" surface.
export function signInRequired(): Response {
  return json({ error: 'sign_in_required' }, { status: 401 });
}

// A project in the Trash (docs/specs/013-workspace/trash.md), answered only to a
// caller who could have opened it: the deleted state, not a not-found.
export function projectTrashed(): Response {
  return json({ error: PROJECT_TRASHED_ERROR }, { status: 410 });
}

// A write that collides with existing state (duplicate invite email,
// demoting the last admin, folder-move cycle). The body's `error`
// token tells the client which rule fired.
export function conflict(reason: string): Response {
  return json({ error: reason }, { status: 409 });
}

// Returned whenever `resolveOwner()` yields null on a mutation / owner-scoped read
// (docs/specs/014-identity/auth-and-guest-access.md): no Bearer was sent, or the one sent failed verification
// (expired, invalid signature, minted for another app, keys unreachable). Every caller, a guest included, holds
// a token liveworkspace minted.
export function missingAuth(): Response {
  return badRequest('authentication required: send a valid access, guest or API token');
}
