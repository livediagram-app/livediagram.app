import type {
  TelemetryApp,
  TelemetryDailyRow,
  TelemetrySender,
  TelemetryWireEvent,
} from '@liveworkspace/telemetry';
import type { Env } from './env';

export async function insertEvents(
  env: Env,
  app: TelemetrySender,
  events: readonly TelemetryWireEvent[],
  ts: number,
): Promise<void> {
  if (events.length === 0) return;
  const stmt = env.TELEMETRY_DB.prepare(
    'INSERT INTO events (app, category, action, type, ts) VALUES (?, ?, ?, ?, ?)',
  );
  await env.TELEMETRY_DB.batch(
    events.map((e) => stmt.bind(app, e.category, e.action, e.type ?? null, ts)),
  );
}

// Per-day per-app per-event counts since `since`: the dashboard's ONE query (summary.ts folds every
// window and series from it). `app` null counts every app.
export async function dailyCountsSince(
  env: Env,
  since: number,
  app: TelemetryApp | null,
): Promise<TelemetryDailyRow[]> {
  const where = app ? 'WHERE app = ? AND ts >= ?' : 'WHERE ts >= ?';
  const stmt = env.TELEMETRY_DB.prepare(
    `SELECT date(ts / 1000, 'unixepoch') AS day, app, category, action, type, COUNT(*) AS count
       FROM events
       ${where}
      GROUP BY day, app, category, action, type`,
  );
  const result = await (app ? stmt.bind(app, since) : stmt.bind(since)).all<TelemetryDailyRow>();
  return result.results ?? [];
}

// Retention: rows older than `cutoff` go. Returns how many, for the log.
export async function deleteEventsBefore(env: Env, cutoff: number): Promise<number> {
  const result = await env.TELEMETRY_DB.prepare('DELETE FROM events WHERE ts < ?')
    .bind(cutoff)
    .run();
  return result.meta.changes ?? 0;
}
