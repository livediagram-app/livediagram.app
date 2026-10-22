import { readdirSync, readFileSync } from 'node:fs';
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import type { Env } from './env';

// A REAL D1 for tests: an in-memory SQLite database with every migration applied, behind the D1
// prepare/bind/first/all/run/batch surface the service calls, as livediagram's api tests have it. D1
// enforces foreign keys, so this turns them on too. Not a `.test.ts` file, so vitest doesn't collect it.

const MIGRATIONS_DIR = fileURLToPath(new URL('../migrations/', import.meta.url).href);

export type TestDb = {
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

export function testDb(overrides: Partial<Env> = {}): TestDb {
  const sql = new DatabaseSync(':memory:');
  sql.exec('PRAGMA foreign_keys = ON');
  for (const file of readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort()) {
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
        return { success: true, meta: { changes: Number(res.changes) } };
      },
      // What D1's batch hands back per statement: a read's rows, a write's change count.
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

  // D1 runs a batch as one transaction: all of it lands or none of it does. Batches queue behind one
  // another, as D1 serialises them.
  let batches: Promise<unknown> = Promise.resolve();
  const runBatch = async (statements: { batchResult: () => Promise<unknown> }[]) => {
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
  };
  const db = {
    prepare: (query: string) => statement(query, []),
    batch: (statements: { batchResult: () => Promise<unknown> }[]) => {
      const run = batches.then(() => runBatch(statements));
      batches = run.catch(() => undefined);
      return run;
    },
  };

  return {
    env: {
      ENVIRONMENT: 'development',
      COMMUNITY_DB: db as unknown as D1Database,
      COMMUNITY_KEY_LIVEDIAGRAM: 'ld-key',
      COMMUNITY_KEY_LIVEPLANNER: 'lp-key',
      ...overrides,
    },
    sql,
  };
}
