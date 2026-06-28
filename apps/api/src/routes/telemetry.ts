// /api/telemetry/summary — public usage dashboard data (spec/22).

import { metricKey, type TelemetrySummary } from '@livediagram/api-schema';
import { telemetryCountsSince, telemetryDailyCountsSince } from '../db';
import { json, notFound } from '../responses';
import type { RouteContext } from './context';

// Public dashboard data (spec/22). Grouped counts for three FIXED
// windows — today (since UTC midnight), last 7 days, last 30 days
// — so the queries stay simple and the response is cacheable. No
// custom ranges. Edge-cached so a public traffic spike never
// hammers D1. Off unless TELEMETRY_ENABLED.
export async function handleTelemetry(ctx: RouteContext): Promise<Response> {
  const { request, env, url, segments } = ctx;
  if (!(segments[1] === 'telemetry' && segments[2] === 'summary' && segments.length === 3)) {
    return notFound();
  }
  if (request.method !== 'GET') return notFound();
  if (env.TELEMETRY_ENABLED !== 'true') return json({ enabled: false });
  // Skip the edge cache when serving from localhost: locally each
  // event the developer fires would otherwise be invisible for up
  // to 5 minutes, making the feature impossible to iterate on. In
  // production the cache stays on (see below) so a traffic spike
  // never hammers D1. Parallel to the localhost same-origin escape
  // hatch above (spec/22).
  const isLocalDev = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
  const cache = caches.default;
  const cacheKey = new Request(url.toString());
  if (!isLocalDev) {
    const hit = await cache.match(cacheKey);
    if (hit) return hit;
  }

  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;
  const d = new Date(now);
  const midnightUtc = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  const dailySince = midnightUtc - 29 * day; // 30 buckets inclusive
  const [today, last7, last30, dailyRows] = await Promise.all([
    telemetryCountsSince(env, midnightUtc),
    telemetryCountsSince(env, now - 7 * day),
    telemetryCountsSince(env, now - 30 * day),
    telemetryDailyCountsSince(env, dailySince),
  ]);
  const toWindow = (rows: typeof today) => ({
    total: rows.reduce((sum, r) => sum + r.count, 0),
    rows,
  });
  // Build the 30-day buckets: `days` carries the UTC-midnight ms
  // for each slot oldest -> newest, with zero-filled totals /
  // category arrays for days that had no events (SQL drops them).
  const days: number[] = [];
  const totals: number[] = [];
  const byCategory: Record<string, number[]> = {};
  const byMetric: Record<string, number[]> = {};
  const dayIndex: Map<string, number> = new Map();
  for (let i = 0; i < 30; i++) {
    const ts = dailySince + i * day;
    days.push(ts);
    totals.push(0);
    // ISO YYYY-MM-DD for matching against SQLite's date() output.
    const iso = new Date(ts).toISOString().slice(0, 10);
    dayIndex.set(iso, i);
  }
  for (const row of dailyRows) {
    const idx = dayIndex.get(row.day);
    if (idx === undefined) continue;
    totals[idx] = (totals[idx] ?? 0) + row.count;
    const cat = byCategory[row.category] ?? new Array(30).fill(0);
    cat[idx] = (cat[idx] ?? 0) + row.count;
    byCategory[row.category] = cat;
    // Per-event series for the Search view's metric trend line. The
    // grouped query already splits on action/type, so each row maps to
    // exactly one metric bucket.
    const key = metricKey(row.category, row.action, row.type);
    const metric = byMetric[key] ?? new Array(30).fill(0);
    metric[idx] = (metric[idx] ?? 0) + row.count;
    byMetric[key] = metric;
  }
  const summary: TelemetrySummary = {
    enabled: true,
    generatedAt: now,
    windows: { today: toWindow(today), last7: toWindow(last7), last30: toWindow(last30) },
    daily: { days, totals, byCategory, byMetric },
  };
  const res = json(summary);
  if (isLocalDev) return res;
  // A few minutes of edge + browser cache. Fixed windows mean the
  // body only drifts on the next ingest, so staleness is bounded
  // and acceptable for a usage dashboard. Awaited (the worker's
  // fetch signature has no ctx.waitUntil) so the put completes.
  res.headers.set('Cache-Control', 'public, max-age=300');
  await cache.put(cacheKey, res.clone());
  return res;
}
