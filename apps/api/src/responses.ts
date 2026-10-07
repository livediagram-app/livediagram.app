// HTTP response helpers shared across the worker's route handlers.
// Lifted out of index.ts so the handler file can focus on routing +
// auth + business logic, and so the response shapes (status codes,
// error-body envelope, CORS preflight header set) have a single
// canonical home that the next route can grep for.

import {
  BUILD_ID_HEADER,
  CHANGESET_SEEN_HEADER,
  CLIENT_HEADER,
  COMMUNITY_KEY_HEADER,
  DOCUMENT_CONVERSION_HEADER,
  DOCUMENT_FORMAT_HEADER,
  DOCUMENT_OPEN_HEADER,
  DOCUMENT_TRASHED_ERROR,
} from '@livediagram/api-schema';

// CORS for the browser. Live app runs at the same hostname as the
// API (router worker stitches them together) so this is mostly a
// safety net for local dev where origins may differ. Headers list
// is the minimum the live app sends today.
export const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  // `Authorization` carries the Clerk Bearer token (Stage 2 hybrid
  // auth, docs/specs/014-identity/auth-and-guest-access.md, docs/specs/015-api/api.md). Without it in the allow-list every
  // signed-in cross-origin request fails the preflight and surfaces
  // to JS as "Failed to fetch", which was hiding behind DELETE
  // /api/account and any other authed call from localhost:3002 to
  // localhost:8787 in dev.
  // Image upload uses custom X-Image-* headers (docs/specs/009-elements/images.md). The browser
  // rejects the POST preflight if any header the client sends isn't
  // in this list, which surfaces as "Failed to fetch" with no other
  // signal, so each new header has to land here too. Take Offline and Sync
  // Diagram declare themselves with DOCUMENT_CONVERSION_HEADER.
  'Access-Control-Allow-Headers': `Authorization, Content-Type, X-Owner-Id, X-Owner-Sig, X-Share-Code, X-Share-Password, X-Allow-Empty, X-Room-Cursor, X-Image-Sha256, X-Image-Width, X-Image-Height, X-Image-Original-Name, ${DOCUMENT_CONVERSION_HEADER}, ${DOCUMENT_OPEN_HEADER}, ${CHANGESET_SEEN_HEADER}, ${CLIENT_HEADER}, ${COMMUNITY_KEY_HEADER}`,
  'Access-Control-Max-Age': '86400',
  // The server release signal (docs/specs/016-platform/new-version-prompt.md, stale-builds.md), readable
  // by an editor on another origin (local dev, a self-host with a separate api host).
  // The tab revision as an ETag (docs/specs/024-agents/agent-changesets.md).
  'Access-Control-Expose-Headers': `${DOCUMENT_FORMAT_HEADER}, ${BUILD_ID_HEADER}, ETag`,
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

// A text body with the JSON helper's CORS and caching (docs/specs/024-agents/document-views.md): a
// document view, which an agent reads as plain text.
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

// An SVG image body (docs/specs/006-document/document-snapshots.md document snapshots). Same CORS treatment as
// `json` so the live app's blob-URL fetch works cross-origin in dev; the
// caller picks the `Cache-Control` (private + long for the owner
// thumbnail, public + short for the live share image).
export const SVG_CSP =
  "default-src 'none'; style-src 'unsafe-inline' https://fonts.googleapis.com; " +
  'font-src https://fonts.gstatic.com; img-src data:; sandbox';

export function svgImage(body: string, cacheControl: string): Response {
  const headers = new Headers(CORS_HEADERS);
  headers.set('Content-Type', 'image/svg+xml; charset=utf-8');
  headers.set('Cache-Control', cacheControl);
  // Served on the app's own origin, so opened directly an SVG is a document
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
// per-field / per-tab caps in the document, tab, and custom-theme routes share.
// Image uploads answer with their own `file_too_large` + `limitBytes` instead.
export function payloadTooLarge(): Response {
  return json({ error: 'payload_too_large' }, { status: 413 });
}

// 502 when the upstream AI provider fails or returns something unusable
// (docs/specs/007-editor/ai-assistance.md). One token for every failure mode so the client shows a single
// "try again" state; the specific cause goes to the worker log instead.
export function aiError(): Response {
  return json({ error: 'ai_error' }, { status: 502 });
}

export function imagesUnavailable(): Response {
  return json({ error: 'images_unavailable' }, { status: 503 });
}

export function rateLimited(): Response {
  return json({ error: 'rate_limited' }, { status: 429 });
}

// The same 429 with a Retry-After header, for a caller (the guest-id mint)
// that waits and tries again rather than giving up.
export function rateLimitedRetryAfter(seconds: number): Response {
  const res = rateLimited();
  res.headers.set('Retry-After', String(seconds));
  return res;
}

// Clerk-only surfaces (teams, docs/specs/013-workspace/teams.md). Unlike missingAuth() below —
// which names both identity sources because either is acceptable —
// this is for endpoints where the guest X-Owner-Id path is
// structurally insufficient (membership is keyed by Clerk user id +
// verified email), so the only fix is signing in. 401 rather than 400
// so the client can branch to its "sign in to use teams" surface.
export function signInRequired(): Response {
  return json({ error: 'sign_in_required' }, { status: 401 });
}

// A document in the Trash (docs/specs/013-workspace/trash.md), answered only to a
// caller who could have opened it: the deleted state, not a not-found.
export function documentTrashed(): Response {
  return json({ error: DOCUMENT_TRASHED_ERROR }, { status: 410 });
}

// A write that collides with existing state (duplicate invite email,
// demoting the last admin, folder-move cycle). The body's `error`
// token tells the client which rule fired.
export function conflict(reason: string): Response {
  return json({ error: reason }, { status: 409 });
}

// Returned whenever `resolveOwner()` yields null on a mutation /
// owner-scoped read. Owner can be null for two reasons under hybrid
// auth (docs/specs/014-identity/auth-and-guest-access.md):
//
//   1. Pure-guest path with no `X-Owner-Id` header sent.
//   2. A Bearer token was sent but verification failed silently
//      (expired, invalid signature, JWKS unreachable, etc.):
//      `getClerkIdentity` returns null on any error so the guest path
//      still serves.
//
// Pre-Clerk this used to be a flat "missing X-Owner-Id" message,
// which now misdirects signed-in users debugging an auth failure to
// look at the wrong header. The new message names both legitimate
// identity sources so the caller can tell which one they're missing.
export function missingAuth(): Response {
  return badRequest('authentication required: send a valid Clerk Bearer token or X-Owner-Id');
}
