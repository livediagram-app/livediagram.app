// A test Env: D1 as a real SQLite database (node:sqlite) with the Worker's own migrations applied, so the tests run
// the same SQL the Worker does.

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import type { Env } from './env';

const MIGRATIONS = join(import.meta.dirname, '../migrations');

type Bound = {
  sql: string;
  args: SQLInputValue[];
  bind: (...args: unknown[]) => Bound;
  all: () => Promise<D1Result>;
  run: () => Promise<D1Result>;
  first: <T>() => Promise<T | null>;
};

export function sqliteD1(): { db: D1Database; raw: DatabaseSync } {
  const raw = new DatabaseSync(':memory:');
  for (const file of readdirSync(MIGRATIONS).toSorted())
    if (file.endsWith('.sql')) raw.exec(readFileSync(join(MIGRATIONS, file), 'utf8'));

  const exec = (sql: string, args: SQLInputValue[]): D1Result => {
    const stmt = raw.prepare(sql);
    if (/^\s*(SELECT|WITH)\b/i.test(sql)) {
      const results = stmt.all(...args) as Record<string, unknown>[];
      return {
        results: results.map((r) => ({ ...r })),
        success: true,
        meta: {} as D1Result['meta'],
      };
    }
    const info = stmt.run(...args);
    return {
      results: [],
      success: true,
      meta: {
        changes: Number(info.changes),
        rows_written: Number(info.changes),
      } as D1Result['meta'],
    };
  };

  const prepare = (sql: string): Bound => {
    const bound = (args: SQLInputValue[]): Bound => ({
      sql,
      args,
      bind: (...next: unknown[]) => bound(next as SQLInputValue[]),
      all: async () => exec(sql, args),
      run: async () => exec(sql, args),
      first: async <T>() => (exec(sql, args).results[0] as T | undefined) ?? null,
    });
    return bound([]);
  };

  const db = {
    prepare,
    batch: async (stmts: Bound[]) => {
      raw.exec('BEGIN');
      try {
        const out = stmts.map((s) => exec(s.sql, s.args));
        raw.exec('COMMIT');
        return out;
      } catch (err) {
        raw.exec('ROLLBACK');
        throw err;
      }
    },
  };
  return { db: db as unknown as D1Database, raw };
}

export function testEnv(overrides: Partial<Env> = {}): Env & { raw: DatabaseSync } {
  const { db, raw } = sqliteD1();
  return {
    ENVIRONMENT: 'production',
    PLATFORM_ORIGIN: 'https://lw.example',
    STATUS_DB: db,
    ...overrides,
    raw,
  };
}
