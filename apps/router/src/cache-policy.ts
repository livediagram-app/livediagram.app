// The caching rules for every site the router fronts (docs/specs/016-platform/stale-builds.md
// "Caching rules"). A page must never come back stale: browsers reuse a cached page on back and
// forward even past max-age=0, and an earlier build's HTML names chunk files the last deploy
// removed, so the page dies before any of its code runs. Only `no-store` prevents that. Build
// assets, named by their content hash, never change, so they are cached for a year; a missing one
// answers an honest plain-text 404 rather than a site's HTML 404 page.
//
// Dependency-free and type-only TypeScript, so the e2e stack (scripts/e2e-stack.mjs) runs this same
// file to serve the editor as production does.

export const HTML_CACHE_CONTROL = 'no-store';
export const IMMUTABLE_CACHE_CONTROL = 'public, max-age=31536000, immutable';

export type CacheRule = 'no-store' | 'immutable' | 'missing-asset' | 'unchanged';

/** A hashed build asset of any of the four sites (`/_next/static/…`, under its prefix or not). */
export function isBuildAsset(pathname: string): boolean {
  return /^(\/[a-z-]+)?\/_next\/static\//.test(pathname);
}

/** Which rule a response falls under. */
export function cacheRule(pathname: string, status: number, contentType: string | null): CacheRule {
  if (isBuildAsset(pathname)) {
    if ((status >= 200 && status < 300) || status === 304) return 'immutable';
    if (status === 404) return 'missing-asset';
    return 'unchanged';
  }
  if ((contentType ?? '').toLowerCase().startsWith('text/html')) return 'no-store';
  return 'unchanged';
}

function withCacheControl(response: Response, value: string): Response {
  const headers = new Headers(response.headers);
  headers.set('Cache-Control', value);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

/** The response with the caching rules applied; untouched when none applies. */
export function applyCachePolicy(response: Response, pathname: string): Response {
  // A WebSocket upgrade carries its socket; rebuilding it would drop the socket.
  if (response.status === 101) return response;
  const rule = cacheRule(pathname, response.status, response.headers.get('Content-Type'));
  if (rule === 'no-store') return withCacheControl(response, HTML_CACHE_CONTROL);
  if (rule === 'immutable') return withCacheControl(response, IMMUTABLE_CACHE_CONTROL);
  if (rule === 'missing-asset') {
    return new Response('Not found', {
      status: 404,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': HTML_CACHE_CONTROL,
        'X-Content-Type-Options': 'nosniff',
      },
    });
  }
  return response;
}
