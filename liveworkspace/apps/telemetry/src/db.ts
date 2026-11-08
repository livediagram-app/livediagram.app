import type {
  TelemetryApp,
  TelemetryDailyRow,
  TelemetrySender,
  TelemetryWireEvent,
} from '@liveworkspace/telemetry';
import { DAY_MS } from './config';
import type { Env } from './env';

// The UTC day `ts` falls on, as SQLite's date(ts / 1000, 'unixepoch') writes it: the day counts' `day`.
export function utcDay(ts: number): string {
  return new Date(ts).toISOString().slice(0, 10);
}

// One batch: each event as its own row, and one day-count upsert per distinct event (the batch's events added up
// first, so 100 of the same event are one statement). D1 runs a batch as one transaction, so the counts never
// disagree with the rows. Six bound parameters per statement, far inside D1's 100.
export async function insertEvents(
  env: Env,
  app: TelemetrySender,
  events: readonly TelemetryWireEvent[],
  ts: number,
): Promise<void> {
  if (events.length === 0) return;
  const insert = env.TELEMETRY_DB.prepare(
    'INSERT INTO events (app, category, action, type, ts) VALUES (?, ?, ?, ?, ?)',
  );
  const upsert = env.TELEMETRY_DB.prepare(
    `INSERT INTO event_counts (app, day, category, action, type, count) VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT (app, day, category, action, type) DO UPDATE SET count = count + excluded.count`,
  );
  const counts = new Map<string, { e: TelemetryWireEvent; n: number }>();
  for (const e of events) {
    // JSON of the three fields: no separator a category or action could contain can merge two events.
    const key = JSON.stringify([e.category, e.action, e.type ?? '']);
    const seen = counts.get(key);
    if (seen) seen.n++;
    else counts.set(key, { e, n: 1 });
  }
  const day = utcDay(ts);
  await env.TELEMETRY_DB.batch([
    ...events.map((e) => insert.bind(app, e.category, e.action, e.type ?? null, ts)),
    ...[...counts.values()].map(({ e, n }) =>
      upsert.bind(app, day, e.category, e.action, e.type ?? '', n),
    ),
  ]);
}

// Per-day per-app per-event counts since `since` (a UTC midnight): the dashboard's ONE query (summary.ts folds every
// window and series from it), read from the day counts, one row per day and event. `app` null counts every app.
// Ordered as the grouped query over the events came out, so rows with equal counts list in the same order as before;
// for one app that is the key's own order, and for every app a sort of the day counts alone.
export async function dailyCountsSince(
  env: Env,
  since: number,
  app: TelemetryApp | null,
): Promise<TelemetryDailyRow[]> {
  const where = app ? 'WHERE app = ? AND day >= ?' : 'WHERE day >= ?';
  const stmt = env.TELEMETRY_DB.prepare(
    `SELECT day, app, category, action, NULLIF(type, '') AS type, count FROM event_counts ${where}
      ORDER BY day, app, category, action, event_counts.type`,
  );
  const day = utcDay(since);
  const result = await (app ? stmt.bind(app, day) : stmt.bind(day)).all<TelemetryDailyRow>();
  return result.results ?? [];
}

// Retention: events older than `cutoff` go, and the day counts of every day before `cutoff`'s (that day itself is
// outside the dashboard's 59). Returns how many of each, for the log.
export async function deleteEventsBefore(
  env: Env,
  cutoff: number,
): Promise<{ events: number; counts: number }> {
  const [events, counts] = await env.TELEMETRY_DB.batch([
    env.TELEMETRY_DB.prepare('DELETE FROM events WHERE ts < ?').bind(cutoff),
    env.TELEMETRY_DB.prepare('DELETE FROM event_counts WHERE day < ?').bind(utcDay(cutoff)),
  ]);
  return { events: events?.meta.changes ?? 0, counts: counts?.meta.changes ?? 0 };
}

// Counts the UTC day starting at `midnight` again from its events and puts that in place of its day counts, in one
// transaction. Anything that ever wrote an event without its count (the seconds of a deploy between the migration
// and the new code) heals here. Reads one day of events through events_ts_idx. Returns the day counts written.
export async function recountDay(env: Env, midnight: number): Promise<number> {
  const day = utcDay(midnight);
  const [, inserted] = await env.TELEMETRY_DB.batch([
    env.TELEMETRY_DB.prepare('DELETE FROM event_counts WHERE day = ?').bind(day),
    env.TELEMETRY_DB.prepare(
      `INSERT INTO event_counts (app, day, category, action, type, count)
       SELECT app, ?, category, action, COALESCE(type, ''), COUNT(*)
         FROM events WHERE ts >= ? AND ts < ?
        GROUP BY app, category, action, COALESCE(type, '')`,
    ).bind(day, midnight, midnight + DAY_MS),
  ]);
  return inserted?.meta.changes ?? 0;
}
