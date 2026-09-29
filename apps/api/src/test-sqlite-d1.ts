import { readdirSync, readFileSync } from 'node:fs';
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import type { Env } from './types';

// A REAL D1 for tests: an in-memory SQLite database with every migration in
// apps/api/migrations applied, behind the D1 prepare/bind/first/all/run/batch
// surface the db/ modules call.
//
// test-d1.ts records which SQL ran; this one answers whether it WORKED. Use it
// where the behaviour lives in the schema: foreign-key cascades, primary-key
// collisions, INSERT OR IGNORE outcomes. D1 enforces foreign keys, so this
// turns them on too.
//
// Not a `.test.ts` file, so vitest doesn't collect it as a suite.

const MIGRATIONS_DIR = fileURLToPath(new URL('../migrations/', import.meta.url).href);

export type SqliteD1 = {
  env: Env;
  // The raw handle, for arranging rows and asserting on them directly.
  sql: DatabaseSync;
};

// D1 binds a boolean as 1 / 0; node:sqlite refuses one outright.
function toSql(value: unknown): SQLInputValue {
  if (typeof value === 'boolean') return value ? 1 : 0;
  if (value === undefined) throw new TypeError('D1_TYPE_ERROR: undefined is not a bindable value');
  return value as SQLInputValue;
}

function migrationFiles(): string[] {
  return readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();
}

// Run the one migration whose file name starts with `prefix` (e.g. '0049'),
// for a test that seeds rows under the previous schema first.
export function applyMigration(sql: DatabaseSync, prefix: string): void {
  const file = migrationFiles().find((f) => f.startsWith(`${prefix}_`));
  if (!file) throw new Error(`no migration ${prefix}`);
  sql.exec(readFileSync(MIGRATIONS_DIR + file, 'utf8'));
}

// Run every migration from `prefix` on, bringing a database seeded under an older schema up to
// the one the current code reads.
export function migrateFrom(sql: DatabaseSync, prefix: string): void {
  for (const file of migrationFiles().filter((f) => f >= prefix)) {
    sql.exec(readFileSync(MIGRATIONS_DIR + file, 'utf8'));
  }
}

// `before` stops short of that migration (e.g. '0049'), leaving it for the
// test to apply with applyMigration.
export function sqliteD1(base: Partial<Env> = {}, opts: { before?: string } = {}): SqliteD1 {
  const sql = new DatabaseSync(':memory:');
  sql.exec('PRAGMA foreign_keys = ON');
  for (const file of migrationFiles()) {
    if (opts.before && file >= opts.before) break;
    sql.exec(readFileSync(MIGRATIONS_DIR + file, 'utf8'));
  }

  const statement = (query: string, args: SQLInputValue[]) => {
    const rows = () =>
      sql
        .prepare(query)
        .all(...args)
        .map((row) => ({ ...row }));
    return {
      bind: (...next: unknown[]) => statement(query, next.map(toSql)),
      first: async (column?: string) => {
        const row = rows()[0] ?? null;
        return column && row ? (row[column] ?? null) : row;
      },
      all: async () => ({ results: rows(), success: true, meta: {} }),
      run: async () => {
        const res = sql.prepare(query).run(...args);
        return {
          success: true,
          meta: { changes: Number(res.changes), last_row_id: Number(res.lastInsertRowid) },
        };
      },
      // What D1's batch hands back per statement: a read's rows, a write's
      // change count.
      batchResult: async () => {
        const prepared = sql.prepare(query);
        if (prepared.columns().length > 0) {
          return { results: rows(), success: true, meta: { changes: 0 } };
        }
        const res = prepared.run(...args);
        return { results: [], success: true, meta: { changes: Number(res.changes) } };
      },
    };
  };

  const db = {
    prepare: (query: string) => statement(query, []),
    // D1 runs a batch as one transaction: all of it lands or none of it does.
    batch: async (statements: { batchResult: () => Promise<unknown> }[]) => {
      sql.exec('BEGIN');
      try {
        const results = [];
        for (const s of statements) results.push(await s.batchResult());
        sql.exec('COMMIT');
        return results;
      } catch (err) {
        sql.exec('ROLLBACK');
        throw err;
      }
    },
  };

  return { env: { ...base, DB: db } as unknown as Env, sql };
}
