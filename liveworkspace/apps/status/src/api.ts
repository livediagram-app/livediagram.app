// The read API (liveworkspace/docs/status.md "The read API"): GET /api/status and /api/status/history?days=, public,
// anonymous and cacheable. Each is one stored row, built by the last run; before any run, an empty answer.

import { clientRateKey } from '@liveworkspace/api-kit/client-ip';
import {
  emptyHistory,
  HISTORY_DAYS,
  parseStatusHistory,
  sliceHistory,
  STATUS_HISTORY_PATH,
  type StatusLatest,
} from '@liveworkspace/status';
import { CACHE_SECONDS } from './config';
import type { Env } from './env';

type Read = 'latest' | 'history';

function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...headers },
  });
}

/** `days` from the query: 1 to 90, 90 when left out, null when it is anything else. */
export function parseDays(value: string | null): number | null {
  if (value === null || value === '') return HISTORY_DAYS;
  if (!/^\d{1,3}$/.test(value)) return null;
  const n = Number(value);
  return n >= 1 && n <= HISTORY_DAYS ? n : null;
}

// A stored row that isn't JSON (cut short, hand-edited) is read as no row, never a 500: the next run rewrites it.
function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

async function readSnapshot(env: Env, key: Read): Promise<string | null> {
  try {
    const row = await env.STATUS_DB.prepare('SELECT body FROM snapshots WHERE key = ?')
      .bind(key)
      .first<{ body: string }>();
    return row?.body ?? null;
  } catch (err) {
    // No table yet (a fresh local database before its migration): the same as no run yet.
    console.error('status snapshot read failed', err);
    return null;
  }
}

export async function handleRead(
  request: Request,
  env: Env,
  ctx: ExecutionContext,
  path: string,
): Promise<Response> {
  const read: Read | null =
    path === '' || path === '/' ? 'latest' : path === STATUS_HISTORY_PATH ? 'history' : null;
  if (!read) return json({ error: 'not_found' }, 404);
  if (request.method !== 'GET' && request.method !== 'HEAD')
    return new Response(null, { status: 405, headers: { Allow: 'GET, HEAD' } });

  const url = new URL(request.url);
  const days = read === 'history' ? parseDays(url.searchParams.get('days')) : HISTORY_DAYS;
  if (days === null) return json({ error: 'bad_days' }, 400);

  // One cache entry per answer, whatever else the URL carries. Locally every run should show at once.
  const cacheKey = new Request(
    `${url.origin}${url.pathname}${read === 'history' ? `?days=${days}` : ''}`,
  );
  const cached = env.ENVIRONMENT !== 'development';
  if (cached) {
    const hit = await caches.default.match(cacheKey);
    // The entry is a GET's answer; a HEAD gets its headers and status only, never the body.
    if (hit) return request.method === 'HEAD' ? new Response(null, hit) : hit;
  }

  if (env.READ_RATE_LIMITER) {
    const { success } = await env.READ_RATE_LIMITER.limit({ key: clientRateKey(request) });
    if (!success) return json({ error: 'rate_limited' }, 429, { 'Retry-After': '60' });
  }

  const body = await readSnapshot(env, read);
  let out: string;
  if (read === 'latest') {
    out = body ?? JSON.stringify({ v: 1, at: null, services: {} } satisfies StatusLatest);
  } else {
    const stored = body ? parseStatusHistory(parseJson(body)) : null;
    // The whole window is the stored text as it is; fewer days, or none stored, is built here.
    out =
      body && stored && days === stored.days
        ? body
        : JSON.stringify(sliceHistory(stored ?? emptyHistory(Date.now()), days));
  }

  const res = new Response(request.method === 'HEAD' ? null : out, {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': `public, max-age=${CACHE_SECONDS}`,
    },
  });
  if (cached && request.method === 'GET')
    ctx.waitUntil(
      caches.default
        .put(cacheKey, res.clone())
        .catch((err: unknown) => console.error('status cache put failed', err)),
    );
  return res;
}
