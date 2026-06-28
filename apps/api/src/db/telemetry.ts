// telemetry events (spec/22). Anonymous: the events table stores only
// the three-field vocabulary + a server-stamped timestamp. No owner /
// IP column.

import type { TelemetryCount } from '@livediagram/api-schema';
import type { Env } from '../types';

export async function insertTelemetryEvents(
  env: Env,
  events: { category: string; action: string; type: string | null }[],
  ts: number,
): Promise<void> {
  if (events.length === 0) return;
  const stmt = env.DB.prepare(
    'INSERT INTO events (category, action, type, ts) VALUES (?, ?, ?, ?)',
  );
  await env.DB.batch(events.map((e) => stmt.bind(e.category, e.action, e.type, ts)));
}

// Retention sweep: drop rows older than `cutoffMs`. Wired to the
// daily 03:00 UTC cron via the worker's `scheduled` handler, with a
// 60-day floor (twice the dashboard's longest window, see spec/22
// "Retention"). The events_ts_idx supports the range scan. Returns
// the row count deleted so the handler can log it for observability,
// mirroring `deleteOldChangeLogEntries`.
export async function deleteOldEvents(env: Env, cutoffMs: number): Promise<number> {
  const result = await env.DB.prepare('DELETE FROM events WHERE ts < ?').bind(cutoffMs).run();
  return result.meta.changes ?? 0;
}

// Per-day per-event counts since `since`, used to render the
// dashboard's daily-volume sparkline, the per-category stacked area
// chart, and the Search view's per-metric trend line. Grouped down to
// (category, action, type) so the caller can fold the rows up into both
// a per-category and a per-metric 30-day series. SQLite's date() with
// the 'unixepoch' modifier produces YYYY-MM-DD which is naturally
// sortable; we re-bucket into the caller's 30-day array client-side
// rather than in SQL so missing-day rows (zero events) still show up as
// zero rather than being dropped. The events_ts_idx covers the range
// filter.
export async function telemetryDailyCountsSince(
  env: Env,
  since: number,
): Promise<
  { day: string; category: string; action: string; type: string | null; count: number }[]
> {
  const result = await env.DB.prepare(
    `SELECT date(ts / 1000, 'unixepoch') AS day, category, action, type, COUNT(*) AS count
       FROM events
      WHERE ts >= ?
      GROUP BY day, category, action, type
      ORDER BY day ASC`,
  )
    .bind(since)
    .all<{ day: string; category: string; action: string; type: string | null; count: number }>();
  return result.results ?? [];
}

// Grouped counts for every event at or after `since` (ms epoch). One
// row per (category, action, type). Drives the dashboard's fixed
// windows; the events_ts_idx covers the range filter.
export async function telemetryCountsSince(env: Env, since: number): Promise<TelemetryCount[]> {
  const result = await env.DB.prepare(
    `SELECT category, action, type, COUNT(*) AS count
       FROM events
      WHERE ts >= ?
      GROUP BY category, action, type
      ORDER BY count DESC`,
  )
    .bind(since)
    .all<TelemetryCount>();
  return result.results ?? [];
}
