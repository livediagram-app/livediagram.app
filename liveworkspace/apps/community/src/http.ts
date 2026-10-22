// Responses, CORS and the edge cache for the Community API (liveworkspace/docs/community.md "The API").

import { communityAppOfOrigin, type CommunityApp } from '@liveworkspace/community';
import type { Env } from './env';

export function json(body: unknown, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers);
  headers.set('Content-Type', 'application/json');
  return new Response(JSON.stringify(body), { ...init, headers });
}

export const notFound = () => json({ error: 'not_found' }, { status: 404 });
export const badRequest = (error: string) => json({ error }, { status: 400 });
export const conflict = (error: string) => json({ error }, { status: 409 });
export const noContent = () => new Response(null, { status: 204 });

// The app a browser page belongs to, by its Origin: one of an app's own sites, or, in development, a
// localhost page (which may speak for any app). Null for any other page.
export function originApp(request: Request, env: Env): CommunityApp | 'localhost' | null {
  const origin = request.headers.get('Origin');
  if (!origin) return null;
  const app = communityAppOfOrigin(origin);
  if (app) return app;
  return env.ENVIRONMENT === 'development' && isLocalhost(origin) ? 'localhost' : null;
}

function isLocalhost(origin: string): boolean {
  try {
    const { hostname } = new URL(origin);
    return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]';
  } catch {
    return false;
  }
}

// What every app page may do across sites: read (with its community key), like, unlike and report. The
// key and the JSON body make these "non-simple" requests, so the browser asks first (OPTIONS).
const ALLOWED_METHODS = 'GET, PUT, DELETE, POST';
const ALLOWED_HEADERS = 'Content-Type, X-Community-Key';

// The CORS headers for a public route's answer. Reads are public, so any page may read them (and one
// edge-cached answer serves every app's pages); a write is only answered to an app's own pages, so
// another site can't like or report on its visitors' behalf.
export function withCors(request: Request, env: Env, res: Response): Response {
  const read = request.method === 'GET' || request.method === 'HEAD';
  const origin = request.headers.get('Origin');
  // A copy: an answer from the edge cache has headers that can't be changed.
  const out = new Response(res.body, res);
  if (read) out.headers.set('Access-Control-Allow-Origin', '*');
  else if (origin && originApp(request, env)) {
    out.headers.set('Access-Control-Allow-Origin', origin);
    out.headers.append('Vary', 'Origin');
  }
  return out;
}

// The answer to a browser's preflight: only an app's own pages may send a write.
export function preflight(request: Request, env: Env): Response {
  const origin = request.headers.get('Origin');
  const headers = new Headers({
    'Access-Control-Allow-Methods': ALLOWED_METHODS,
    'Access-Control-Allow-Headers': ALLOWED_HEADERS,
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  });
  if (origin && originApp(request, env)) headers.set('Access-Control-Allow-Origin', origin);
  return new Response(null, { status: 204, headers });
}

// A public, identity-free GET answered from Cloudflare's edge cache for a short while: a Worker's own
// responses never enter the CDN cache by their Cache-Control alone. Only for answers that are the same
// for every caller. Skipped in development (a like should show at once) and where the runtime has no
// Cache API (tests). Only a 200 is kept.
export async function edgeCached(
  env: Env,
  ctx: ExecutionContext,
  url: URL,
  maxAgeSeconds: number,
  produce: () => Promise<Response>,
): Promise<Response> {
  const cache =
    typeof caches === 'undefined' || env.ENVIRONMENT === 'development' ? null : caches.default;
  const key = new Request(url.toString());
  if (cache) {
    const hit = await cache.match(key);
    if (hit) return hit;
  }
  const res = await produce();
  if (res.status !== 200) return res;
  res.headers.set('Cache-Control', `public, max-age=${maxAgeSeconds}`);
  if (cache) ctx.waitUntil(cache.put(key, res.clone()));
  return res;
}
