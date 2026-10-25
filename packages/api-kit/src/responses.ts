// The HTTP responses every product's api Worker answers with: the error-body envelope, its status codes and the
// CORS header set on every response. A product binds them to its own CORS headers once, in its responses.ts, and
// keeps there only the answers that are its own (a trashed item's token, an AI or images failure).

// The CORS header set (Access-Control-*), as every response carries it.
export type CorsHeaders = Readonly<Record<string, string>>;

// The request headers every product's editor sends: the account or guest token, JSON bodies, the index grant
// and the share link (with its password), the empty-save opt-in and the room cursor. A product adds its own.
export const BASE_ALLOWED_HEADERS: readonly string[] = [
  'Authorization',
  'Content-Type',
  'X-Index-Grant',
  'X-Share-Code',
  'X-Share-Password',
  'X-Allow-Empty',
  'X-Room-Cursor',
];

// CORS for the browser. An editor runs on the same hostname as its api (the router stitches them together), so
// this is mostly a safety net for local development, where the ports differ, and for a deployment with a separate
// api host. The browser rejects a preflight if any header the client sends is not allowed, which surfaces as
// "Failed to fetch" with no other signal, so each new header has to land here too. `expose` names the response
// headers a page on another origin may read (the release signal, ETag).
export function corsHeaders(options: {
  allowHeaders: readonly string[];
  exposeHeaders: readonly string[];
}): CorsHeaders {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': [...BASE_ALLOWED_HEADERS, ...options.allowHeaders].join(', '),
    'Access-Control-Max-Age': '86400',
    'Access-Control-Expose-Headers': options.exposeHeaders.join(', '),
  };
}

// An SVG served on the app's own origin is a document that could run script when opened directly. The renderer
// escapes everything it writes; this keeps a future slip there from becoming stored XSS. Fonts and inline data
// images (what a drawing uses) still load.
export const SVG_CSP =
  "default-src 'none'; style-src 'unsafe-inline' https://fonts.googleapis.com; " +
  'font-src https://fonts.gstatic.com; img-src data:; sandbox';

export type Responses = ReturnType<typeof createResponses>;

export function createResponses(cors: CorsHeaders) {
  const withCors = (init: ResponseInit, contentType: string): Headers => {
    const headers = new Headers(init.headers);
    headers.set('Content-Type', contentType);
    if (!headers.has('Cache-Control')) headers.set('Cache-Control', 'no-cache');
    for (const [k, v] of Object.entries(cors)) headers.set(k, v);
    return headers;
  };

  // An answer is the caller's live state, so a browser asks again before reusing it unless the route chooses a
  // policy: Chromium keeps a 410 with no explicit expiry indefinitely, so a cached "deleted" would outlive the
  // restore. `no-cache`, not `no-store`: a stored answer is drained by the cache even when its caller never reads
  // the body.
  function json(body: unknown, init: ResponseInit = {}): Response {
    return new Response(JSON.stringify(body), {
      ...init,
      headers: withCors(init, 'application/json'),
    });
  }

  // A text body with the JSON helper's CORS and caching: a view of an item, which an agent reads as plain text.
  function textPlain(body: string, init: ResponseInit = {}): Response {
    return new Response(body, { ...init, headers: withCors(init, 'text/plain; charset=utf-8') });
  }

  // An SVG image body (a tab drawn on request), with the JSON helper's CORS so an editor's blob-URL fetch works
  // cross-origin in dev; the caller picks the `Cache-Control`.
  function svgImage(body: string, cacheControl: string): Response {
    const headers = new Headers(cors);
    headers.set('Content-Type', 'image/svg+xml; charset=utf-8');
    headers.set('Cache-Control', cacheControl);
    headers.set('Content-Security-Policy', SVG_CSP);
    headers.set('X-Content-Type-Options', 'nosniff');
    return new Response(body, { headers });
  }

  // 204 No Content with the CORS header set: a successful write that returns no body.
  const noContent = (): Response => new Response(null, { status: 204, headers: cors });

  const notFound = (): Response => json({ error: 'not_found' }, { status: 404 });

  const badRequest = (message: string): Response =>
    json({ error: 'bad_request', message }, { status: 400 });

  // 403 with `forbidden` by default; a `reason` names the rule that fired (`admin_required`, `not_your_invite`)
  // while the envelope stays uniform. Tokens are snake_case, like every other error here.
  const forbidden = (reason = 'forbidden'): Response => json({ error: reason }, { status: 403 });

  // 405 for a known route hit with the wrong method.
  const methodNotAllowed = (): Response => json({ error: 'method_not_allowed' }, { status: 405 });

  // 413 for a body over a route's size cap (the body gate and the per-field and per-tab caps).
  const payloadTooLarge = (): Response => json({ error: 'payload_too_large' }, { status: 413 });

  const rateLimited = (): Response => json({ error: 'rate_limited' }, { status: 429 });

  // Signed-in only surfaces (teams): a guest token is structurally insufficient there (membership is keyed by
  // account id and verified email), so the only fix is signing in. 401 rather than 400, so the client can branch
  // to its "sign in" surface.
  const signInRequired = (): Response => json({ error: 'sign_in_required' }, { status: 401 });

  // A write that collides with existing state (a duplicate invite, demoting the last admin, a folder-move cycle);
  // the `error` token says which rule fired.
  const conflict = (reason: string): Response => json({ error: reason }, { status: 409 });

  // No caller resolved on a mutation or an owner-scoped read: no Bearer at all, or one that failed verification
  // (expired, invalid signature, minted for another app, keys unreachable), which reads as no one rather than as
  // an error. The message names every identity a caller may send, so they can tell which is missing.
  const missingAuth = (): Response =>
    badRequest(
      'authentication required: send a valid account access token, guest token or API token',
    );

  return {
    json,
    textPlain,
    svgImage,
    noContent,
    notFound,
    badRequest,
    forbidden,
    methodNotAllowed,
    payloadTooLarge,
    rateLimited,
    signInRequired,
    conflict,
    missingAuth,
  };
}
