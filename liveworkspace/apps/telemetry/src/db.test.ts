// The day counts (liveworkspace/docs/specs/008-telemetry/telemetry.md "Sending events", "Retention", "Performance"):
// the summary's rows from them equal the raw-event query they replaced, on random data; ingest adds a batch up first;
// retention and the recount keep them in step with the events; the migration fills them from what is stored.

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import {
  buildTelemetrySummary,
  TELEMETRY_SENDERS,
  telemetryQueryStart,
  type TelemetryApp,
  type TelemetryDailyRow,
  type TelemetrySender,
} from '@liveworkspace/telemetry';
import { describe, expect, it } from 'vitest';
import { DAY_MS, RETENTION_MS } from './config';
import { dailyCountsSince, deleteEventsBefore, insertEvents, recountDay, utcDay } from './db';
import { MIGRATIONS, seedEvents, testEnv, type Row } from './test-env';

// The summary's query before the day counts, over every event: what the counts must reproduce exactly.
const RAW_QUERY = `SELECT date(ts / 1000, 'unixepoch') AS day, app, category, action, type, COUNT(*) AS count
  FROM events WHERE (? IS NULL OR app = ?) AND ts >= ?
 GROUP BY day, app, category, action, type`;

function rawCounts(raw: DatabaseSync, since: number, app: string | null): TelemetryDailyRow[] {
  return raw.prepare(RAW_QUERY).all(app, app, since) as TelemetryDailyRow[];
}

const sorted = (rows: readonly TelemetryDailyRow[]) =>
  rows.map((r) => ({ ...r })).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));

// A small seeded generator, so a failure replays.
function random(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1_664_525 + 1_013_904_223) >>> 0;
    return s / 2 ** 32;
  };
}

const NOW = Date.UTC(2026, 10, 8, 13, 37);
const APPS = TELEMETRY_SENDERS;

describe('the day counts', () => {
  it('give the summary the same rows and numbers as counting the events, on random batches', async () => {
    for (const seed of [1, 2]) {
      const env = testEnv();
      const rand = random(seed);
      const pick = <T>(xs: readonly T[]) => xs[Math.floor(rand() * xs.length)]!;
      for (let b = 0; b < 200; b++) {
        // Any time in the 60 days, so the days around the query start and the series start are both crossed.
        const ts = NOW - Math.floor(rand() * RETENTION_MS);
        const events = Array.from({ length: 1 + Math.floor(rand() * 100) }, () => ({
          category: pick(['Document', 'Element', 'UI']),
          action: pick(['Created', 'Added', 'Toggled']),
          ...(rand() < 0.5 ? {} : { type: pick(['Square', 'Circle', 'Arrow']) }),
        }));
        await insertEvents(env, pick(APPS), events, ts);
      }
      const since = telemetryQueryStart(NOW);
      for (const app of [
        null,
        ...APPS.filter((a): a is TelemetryApp => a !== 'liveworkspace.app'),
      ]) {
        const fromCounts = await dailyCountsSince(env, since, app);
        const fromEvents = rawCounts(env.raw, since, app);
        expect(fromCounts.length).toBeGreaterThan(0);
        expect(sorted(fromCounts)).toEqual(sorted(fromEvents));
        const apps: readonly TelemetrySender[] = app ? [app] : APPS;
        expect(buildTelemetrySummary(NOW, app ?? 'all', apps, fromCounts)).toEqual(
          buildTelemetrySummary(NOW, app ?? 'all', apps, fromEvents),
        );
      }
    }
  }, 30_000);

  it('adds a batch up first: one upsert per distinct event, added to what the day holds', async () => {
    const env = testEnv();
    const statements: number[] = [];
    const batch = env.TELEMETRY_DB.batch.bind(env.TELEMETRY_DB);
    env.TELEMETRY_DB.batch = (stmts) => {
      statements.push(stmts.length);
      return batch(stmts);
    };
    const created = { category: 'Document', action: 'Created' };
    const square = { category: 'Element', action: 'Added', type: 'Square' };
    await insertEvents(env, 'livediagram.app', [created, square, created, created], NOW);
    await insertEvents(env, 'livediagram.app', [created, square], NOW + 1000);
    await insertEvents(env, 'liveplanner.app', [created], NOW);
    await insertEvents(env, 'liveplanner.app', [], NOW);

    // 4 events and 2 counts, then 2 and 2, then 1 and 1; an empty batch writes nothing.
    expect(statements).toEqual([6, 4, 2]);
    expect(env.rows).toHaveLength(7);
    const day = utcDay(NOW);
    expect(env.counts).toEqual([
      { app: 'livediagram.app', day, category: 'Document', action: 'Created', type: '', count: 4 },
      {
        app: 'livediagram.app',
        day,
        category: 'Element',
        action: 'Added',
        type: 'Square',
        count: 2,
      },
      { app: 'liveplanner.app', day, category: 'Document', action: 'Created', type: '', count: 1 },
    ]);
  });

  it('keeps a type apart from one without, and a category from an action with the same text', async () => {
    const env = testEnv();
    await insertEvents(
      env,
      'livediagram.app',
      [
        { category: 'A|B', action: 'C' },
        { category: 'A', action: 'B|C' },
        { category: 'A', action: 'B', type: 'C' },
        { category: 'A', action: 'B' },
      ],
      NOW,
    );
    expect(env.counts.map((c) => [c.category, c.action, c.type, c.count])).toEqual([
      ['A', 'B', '', 1],
      ['A', 'B', 'C', 1],
      ['A', 'B|C', '', 1],
      ['A|B', 'C', '', 1],
    ]);
    // Read back with no type as null, as the events hold it.
    const rows = await dailyCountsSince(env, telemetryQueryStart(NOW), null);
    expect(rows.filter((r) => r.type === null)).toHaveLength(3);
  });

  it('loses a batch whole: a failed upsert stores none of its events', async () => {
    const env = testEnv();
    env.raw.exec('DROP TABLE event_counts');
    await expect(
      insertEvents(env, 'livediagram.app', [{ category: 'Document', action: 'Created' }], NOW),
    ).rejects.toThrow();
    expect(env.rows).toEqual([]);
  });

  it('retention drops old events and the day counts of every day before the cutoff’s', async () => {
    const env = testEnv();
    const cutoff = NOW - RETENTION_MS;
    const event = { category: 'Document', action: 'Created' };
    await insertEvents(env, 'livediagram.app', [event], cutoff - DAY_MS);
    await insertEvents(env, 'livediagram.app', [event, event], cutoff - 1);
    await insertEvents(env, 'livediagram.app', [event], cutoff);
    await insertEvents(env, 'livediagram.app', [event], NOW);

    expect(await deleteEventsBefore(env, cutoff)).toEqual({ events: 3, counts: 1 });
    expect(env.rows.map((r) => r.ts)).toEqual([cutoff, NOW]);
    // The cutoff's own day stays (outside the dashboard's 59 days anyway); the day before it goes.
    expect(env.counts.map((c) => c.day)).toEqual([utcDay(cutoff), utcDay(NOW)]);
    expect(utcDay(cutoff) < utcDay(telemetryQueryStart(NOW))).toBe(true);
  });

  it('recounts a day from its events, healing an event stored without its count', async () => {
    const env = testEnv();
    const midnight = NOW - (NOW % DAY_MS) - DAY_MS;
    const event = { category: 'Document', action: 'Created' };
    await insertEvents(env, 'livediagram.app', [event, event], midnight + 5);
    // The deploy's gap: the old code stored these without counting them.
    env.seed([
      {
        app: 'livediagram.app',
        category: 'Document',
        action: 'Created',
        type: null,
        ts: midnight + 9,
      },
      {
        app: 'livehuddle.app',
        category: 'UI',
        action: 'Toggled',
        type: 'X',
        ts: midnight + DAY_MS - 1,
      },
      // The days either side are not this day's.
      {
        app: 'livediagram.app',
        category: 'Document',
        action: 'Created',
        type: null,
        ts: midnight - 1,
      },
      {
        app: 'livediagram.app',
        category: 'Document',
        action: 'Created',
        type: null,
        ts: midnight + DAY_MS,
      },
    ]);

    expect(await recountDay(env, midnight)).toBe(2);
    const day = utcDay(midnight);
    expect(env.counts).toEqual([
      { app: 'livediagram.app', day, category: 'Document', action: 'Created', type: '', count: 3 },
      { app: 'livehuddle.app', day, category: 'UI', action: 'Toggled', type: 'X', count: 1 },
    ]);
    // Counting again changes nothing.
    await recountDay(env, midnight);
    expect(env.counts.map((c) => c.count)).toEqual([3, 1]);
  });
});

describe('the migration that adds the day counts', () => {
  const files = readdirSync(MIGRATIONS)
    .filter((f) => f.endsWith('.sql'))
    .toSorted();
  const apply = (raw: DatabaseSync, file: string) =>
    raw.exec(readFileSync(join(MIGRATIONS, file), 'utf8'));

  it('fills them from every stored event, so the summary is the same on the day it ships', () => {
    const raw = new DatabaseSync(':memory:');
    const [first, ...rest] = files;
    apply(raw, first!);
    const rand = random(7);
    const rows: Row[] = Array.from({ length: 5000 }, () => ({
      app: APPS[Math.floor(rand() * APPS.length)]!,
      category: rand() < 0.5 ? 'Document' : 'Element',
      action: rand() < 0.5 ? 'Created' : 'Added',
      type: rand() < 0.3 ? null : `T${Math.floor(rand() * 4)}`,
      ts: NOW - Math.floor(rand() * RETENTION_MS),
    }));
    seedEvents(raw, rows);
    const since = telemetryQueryStart(NOW);
    const before = rawCounts(raw, since, null);

    for (const file of rest) apply(raw, file);

    const after = raw
      .prepare(
        `SELECT day, app, category, action, NULLIF(type, '') AS type, count FROM event_counts WHERE day >= ?`,
      )
      .all(utcDay(since)) as TelemetryDailyRow[];
    expect(sorted(after)).toEqual(sorted(before));
    const total = raw.prepare('SELECT SUM(count) AS n FROM event_counts').get() as { n: number };
    expect(total.n).toBe(rows.length);
    // One app's range of events is no longer read, so its index is gone; the sweep's stays.
    const indexes = raw
      .prepare(`SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name = 'events'`)
      .all()
      .map((r) => r.name);
    expect(indexes).toEqual(['events_ts_idx']);
  });
});

describe('the summary’s cost', () => {
  it('reads only the day counts, through their key, never the events', async () => {
    const env = testEnv();
    const seen: string[] = [];
    const prepare = env.TELEMETRY_DB.prepare.bind(env.TELEMETRY_DB);
    env.TELEMETRY_DB.prepare = (sql) => {
      seen.push(sql);
      return prepare(sql);
    };
    await dailyCountsSince(env, telemetryQueryStart(NOW), 'livediagram.app');
    await dailyCountsSince(env, telemetryQueryStart(NOW), null);
    expect(seen).toHaveLength(2);
    for (const sql of seen) {
      expect(sql).toContain('FROM event_counts');
      expect(sql).not.toMatch(/\bevents\b/);
    }
    // One app's read is a range of the key, not a scan.
    const plan = env.raw
      .prepare(`EXPLAIN QUERY PLAN ${seen[0]}`)
      .all('livediagram.app', '2026-01-01');
    expect(JSON.stringify(plan)).toContain('USING PRIMARY KEY (app=? AND day>?)');
  });

  it('reads one row per day and event however many events arrived', async () => {
    const env = testEnv();
    const events = Array.from({ length: 100 }, (_, i) => ({
      category: 'Element',
      action: 'Added',
      type: `T${i % 10}`,
    }));
    // 10,000 events over 5 days: the summary still reads 5 days × 10 events.
    for (let d = 0; d < 5; d++)
      for (let b = 0; b < 20; b++)
        await insertEvents(env, 'livediagram.app', events, NOW - d * DAY_MS);
    expect(env.rows).toHaveLength(10_000);
    expect(await dailyCountsSince(env, telemetryQueryStart(NOW), null)).toHaveLength(50);
  });

  it('answers a worst case of day counts inside a CPU-time budget', async () => {
    const env = testEnv();
    // 59 days × every app × 300 distinct events: about 106,000 day counts, more than any app sends.
    env.raw
      .prepare(
        `WITH RECURSIVE d(n) AS (SELECT 0 UNION ALL SELECT n + 1 FROM d WHERE n < 58),
              e(n) AS (SELECT 0 UNION ALL SELECT n + 1 FROM e WHERE n < 299)
         INSERT INTO event_counts (app, day, category, action, type, count)
         SELECT a.value, date(? / 1000 - d.n * 86400, 'unixepoch'), 'Element', 'Added', 'T' || e.n, 3
           FROM json_each(?) AS a, d, e`,
      )
      .run(NOW, JSON.stringify(APPS));

    const start = process.cpuUsage();
    const rows = await dailyCountsSince(env, telemetryQueryStart(NOW), null);
    buildTelemetrySummary(NOW, 'all', APPS, rows);
    const used = process.cpuUsage(start);
    expect(rows).toHaveLength(59 * APPS.length * 300);
    // About 0.7 s of CPU on a busy laptop; the raw query this replaced took 1.5 to 32 s at 1 million events.
    expect((used.user + used.system) / 1000).toBeLessThan(3000);
    // The budget is CPU time; the wall-clock limit only has to outlast a loaded machine.
  }, 30_000);

  it('binds at most six parameters a statement, inside D1’s 100', async () => {
    const env = testEnv();
    const events = Array.from({ length: 100 }, (_, i) => ({
      category: 'Element',
      action: 'Added',
      type: `T${i}`,
    }));
    // 100 distinct events: 200 statements, none past the shim's D1 cap.
    await expect(insertEvents(env, 'livediagram.app', events, NOW)).resolves.toBeUndefined();
    expect(env.counts).toHaveLength(100);
  });
});
