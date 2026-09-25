// /api/telemetry/summary — public usage dashboard data (spec/22).

import {
  metricKey,
  TELEMETRY_WINDOW_DAYS,
  type TelemetryCount,
  type TelemetrySummary,
  type TelemetryWindow,
  type TelemetryWindowKey,
} from '@livediagram/api-schema';
import { telemetryDailyCountsSince } from '../db';
import { json, notFound } from '../responses';
import type { RouteContext } from './context';

const DAY_MS = 24 * 60 * 60 * 1000;
const SERIES_DAYS = TELEMETRY_WINDOW_DAYS.last30;

type DailyRow = Awaited<ReturnType<typeof telemetryDailyCountsSince>>[number];

// Public dashboard data (spec/22). Grouped counts for three FIXED
// windows so the queries stay simple and the response is cacheable. No
// custom ranges. Edge-cached so a public traffic spike never hammers
// D1. Off unless TELEMETRY_ENABLED.
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
  const cacheKey = new Request(url.toString());
  if (!isLocalDev) {
    const hit = await caches.default.match(cacheKey);
    if (hit) return hit;
  }

  const now = Date.now();
  const summary = buildTelemetrySummary(
    now,
    await telemetryDailyCountsSince(env, telemetryQueryStart(now)),
  );
  const res = json(summary);
  if (isLocalDev) return res;
  // A few minutes of edge + browser cache. Fixed windows mean the
  // body only drifts on the next ingest, so staleness is bounded
  // and acceptable for a usage dashboard. Awaited (the worker's
  // fetch signature has no ctx.waitUntil) so the put completes.
  res.headers.set('Cache-Control', 'public, max-age=300');
  await caches.default.put(cacheKey, res.clone());
  return res;
}

// UTC midnight of the oldest day in the 30-day series: today's midnight
// minus 29 days, so the series has 30 whole-day buckets ending today.
export function telemetrySeriesStart(now: number): number {
  const d = new Date(now);
  const midnightUtc = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  return midnightUtc - (SERIES_DAYS - 1) * DAY_MS;
}

// The query reaches one series further back than the series itself, so each
// window can be compared with the span just before it (`previousWindows`):
// the 30 days before the last 30 end 59 days back, inside the 60-day
// retention (spec/22).
export function telemetryQueryStart(now: number): number {
  return telemetrySeriesStart(now) - SERIES_DAYS * DAY_MS;
}

// Build the whole summary from ONE per-day query. Each window is the sum of
// its last N day buckets (TELEMETRY_WINDOW_DAYS), so a window covers exactly
// the calendar days the dashboard highlights on the trend line: today since
// UTC midnight, last7 from midnight six days back, last30 from midnight 29
// days back. The windows used to be separate rolling queries (`now - 7d`,
// `now - 30d`), which counted a partial extra day the highlighted span didn't
// show, so a card's number and the line under it disagreed.
export function buildTelemetrySummary(now: number, dailyRows: DailyRow[]): TelemetrySummary {
  const since = telemetrySeriesStart(now);
  // `days` carries the UTC-midnight ms for each slot oldest -> newest, with
  // zero-filled totals / category arrays for days that had no events (SQL
  // drops them).
  const days: number[] = [];
  const totals: number[] = [];
  const byCategory: Record<string, number[]> = {};
  const byMetric: Record<string, number[]> = {};
  const dayIndex: Map<string, number> = new Map();
  for (let i = 0; i < SERIES_DAYS; i++) {
    const ts = since + i * DAY_MS;
    days.push(ts);
    totals.push(0);
    // ISO YYYY-MM-DD for matching against SQLite's date() output.
    dayIndex.set(new Date(ts).toISOString().slice(0, 10), i);
  }
  const keys = Object.keys(TELEMETRY_WINDOW_DAYS) as TelemetryWindowKey[];
  const emptyWindows = () =>
    Object.fromEntries(keys.map((k) => [k, new Map<string, TelemetryCount>()])) as Record<
      TelemetryWindowKey,
      Map<string, TelemetryCount>
    >;
  const windowRows = emptyWindows();
  const previousRows = emptyWindows();
  const addTo = (rows: Map<string, TelemetryCount>, key: string, row: DailyRow) => {
    const prev = rows.get(key);
    if (prev) prev.count += row.count;
    else
      rows.set(key, {
        category: row.category,
        action: row.action,
        type: row.type,
        count: row.count,
      });
  };

  for (const row of dailyRows) {
    const key = metricKey(row.category, row.action, row.type);
    // Days from the series start: 0..29 inside the series, negative before it.
    const offset = Math.round((Date.parse(`${row.day}T00:00:00Z`) - since) / DAY_MS);
    if (offset < 0) {
      // Only the span just before each window, for the trend arrows.
      for (const k of keys) {
        const n = TELEMETRY_WINDOW_DAYS[k];
        if (offset >= SERIES_DAYS - 2 * n && offset < SERIES_DAYS - n)
          addTo(previousRows[k], key, row);
      }
      continue;
    }
    const idx = dayIndex.get(row.day);
    if (idx === undefined) continue;
    totals[idx] = (totals[idx] ?? 0) + row.count;
    const cat = byCategory[row.category] ?? new Array(SERIES_DAYS).fill(0);
    cat[idx] = (cat[idx] ?? 0) + row.count;
    byCategory[row.category] = cat;
    // Per-event series for the Search view's metric trend line. The
    // grouped query already splits on action/type, so each row maps to
    // exactly one metric bucket.
    const metric = byMetric[key] ?? new Array(SERIES_DAYS).fill(0);
    metric[idx] = (metric[idx] ?? 0) + row.count;
    byMetric[key] = metric;
    for (const k of keys) {
      const n = TELEMETRY_WINDOW_DAYS[k];
      if (idx >= SERIES_DAYS - n) addTo(windowRows[k], key, row);
      // The previous span of a short window sits inside the series.
      else if (idx >= SERIES_DAYS - 2 * n) addTo(previousRows[k], key, row);
    }
  }

  const toWindow = (rows: Map<string, TelemetryCount>): TelemetryWindow => {
    const sorted = [...rows.values()].sort((a, b) => b.count - a.count);
    return { total: sorted.reduce((sum, r) => sum + r.count, 0), rows: sorted };
  };
  return {
    enabled: true,
    generatedAt: now,
    windows: {
      today: toWindow(windowRows.today),
      last7: toWindow(windowRows.last7),
      last30: toWindow(windowRows.last30),
    },
    previousWindows: {
      today: toWindow(previousRows.today),
      last7: toWindow(previousRows.last7),
      last30: toWindow(previousRows.last30),
    },
    daily: { days, totals, byCategory, byMetric },
  };
}
