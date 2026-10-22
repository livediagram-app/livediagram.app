// GET /telemetry/api/summary?app=…: the dashboard's numbers (liveworkspace/docs/telemetry.md "The
// dashboard"), for one app or, with app=all or no app, for every app. Public and anonymous.

import {
  ALL_TELEMETRY_APPS,
  buildTelemetrySummary,
  isTelemetryAppFilter,
  TELEMETRY_APPS,
  telemetryQueryStart,
} from '@liveworkspace/telemetry';
import { dailyCountsSince } from './db';
import type { Env } from './env';

// Fixed windows mean the body only drifts as events arrive, so a few minutes stale is fine, and a
// traffic spike on the public page is answered from the edge rather than from D1.
const CACHE_SECONDS = 300;

export async function handleSummary(
  request: Request,
  env: Env,
  ctx: ExecutionContext,
): Promise<Response> {
  if (env.TELEMETRY_ENABLED !== 'true') return json({ enabled: false });
  const url = new URL(request.url);
  const asked = url.searchParams.get('app') ?? ALL_TELEMETRY_APPS;
  if (!isTelemetryAppFilter(asked)) return json({ error: 'unknown_app' }, 400);

  // One cache entry per filter, whatever else the URL carries.
  const cacheKey = new Request(`${url.origin}${url.pathname}?app=${encodeURIComponent(asked)}`);
  // Locally every event should show at once, so development skips the cache.
  const cached = env.ENVIRONMENT !== 'development';
  if (cached) {
    const hit = await caches.default.match(cacheKey);
    if (hit) return hit;
  }

  const now = Date.now();
  const app = asked === ALL_TELEMETRY_APPS ? null : asked;
  const rows = await dailyCountsSince(env, telemetryQueryStart(now), app);
  const res = json(buildTelemetrySummary(now, asked, app ? [app] : TELEMETRY_APPS, rows));
  if (!cached) return res;
  res.headers.set('Cache-Control', `public, max-age=${CACHE_SECONDS}`);
  ctx.waitUntil(caches.default.put(cacheKey, res.clone()));
  return res;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}
