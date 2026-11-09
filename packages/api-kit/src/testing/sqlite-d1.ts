// D1 as a real SQLite database (node:sqlite) with a Worker's own migrations applied, in order, so a service's tests
// run the same SQL the Worker does. `raw` is the database itself, for seeding and reading behind the Worker's back.
// Not a `.test.ts` file, so vitest doesn't collect it as a suite. D1 refuses a compound SELECT of more than five
// terms, where node:sqlite allows 500, so every statement and migration passes the guard first; and it caps a statement
// at 100 bound parameters, where node:sqlite allows 32,766, so a statement binding more is refused as D1 would.

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { assertD1Compound } from '../d1-compound-guard';

export const D1_MAX_BOUND_PARAMS = 100;

type Bound = {
  sql: string;
  args: SQLInputValue[];
  bind: (...args: unknown[]) => Bound;
  all: () => Promise<D1Result>;
  run: () => Promise<D1Result>;
  first: <T>() => Promise<T | null>;
};

export function sqliteD1(migrationsDir: string): { db: D1Database; raw: DatabaseSync } {
  const raw = new DatabaseSync(':memory:');
  for (const file of readdirSync(migrationsDir).toSorted()) {
    if (!file.endsWith('.sql')) continue;
    const migration = readFileSync(join(migrationsDir, file), 'utf8');
    assertD1Compound(migration);
    raw.exec(migration);
  }

  const exec = (sql: string, args: SQLInputValue[]): D1Result => {
    if (args.length > D1_MAX_BOUND_PARAMS) throw new Error('D1_ERROR: too many SQL variables');
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

  // D1 refuses a compound SELECT of more than five terms, where node:sqlite allows 500.
  const prepare = (sql: string): Bound => {
    assertD1Compound(sql);
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
