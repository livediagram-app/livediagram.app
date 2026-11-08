// A test Env: D1 as a real SQLite database (node:sqlite) with the Worker's own migrations applied, so the tests run
// the same SQL the Worker does. `rows` and `counts` read the two tables back; `seed` writes events behind the
// Worker's back, without their day counts, as rows stored before the counts existed would be.

import { join } from 'node:path';
import type { DatabaseSync } from 'node:sqlite';
import { sqliteD1 } from '@liveworkspace/api-kit/testing/sqlite-d1';
import type { Env } from './env';

export const MIGRATIONS = join(import.meta.dirname, '../migrations');

export type Row = {
  app: string;
  category: string;
  action: string;
  type: string | null;
  ts: number;
};

export type CountRow = {
  app: string;
  day: string;
  category: string;
  action: string;
  type: string;
  count: number;
};

export type TestEnv = Env & {
  raw: DatabaseSync;
  readonly rows: Row[];
  readonly counts: CountRow[];
  seed: (rows: readonly Row[]) => void;
};

export function testEnv(overrides: Partial<Env> = {}): TestEnv {
  const { db, raw } = sqliteD1(MIGRATIONS);
  const env = {
    ENVIRONMENT: 'development',
    TELEMETRY_ENABLED: 'true',
    TELEMETRY_DB: db,
    TELEMETRY_KEY_LIVEDIAGRAM: 'ld-key',
    TELEMETRY_KEY_LIVEPLANNER: 'lp-key',
    ...overrides,
    raw,
    seed: (rows: readonly Row[]) => seedEvents(raw, rows),
  };
  return Object.defineProperties(env, {
    rows: {
      get: () =>
        raw.prepare('SELECT app, category, action, type, ts FROM events ORDER BY rowid').all(),
    },
    counts: {
      get: () =>
        raw
          .prepare(
            'SELECT app, day, category, action, type, count FROM event_counts ORDER BY app, day, category, action, type',
          )
          .all(),
    },
  }) as TestEnv;
}

export function seedEvents(raw: DatabaseSync, rows: readonly Row[]): void {
  const stmt = raw.prepare(
    'INSERT INTO events (app, category, action, type, ts) VALUES (?, ?, ?, ?, ?)',
  );
  raw.exec('BEGIN');
  for (const r of rows) stmt.run(r.app, r.category, r.action, r.type, r.ts);
  raw.exec('COMMIT');
}
