// A REAL D1 for a liveworkspace service's tests (the Community, the index, the media service): an in-memory SQLite
// database with every migration applied, behind the D1 prepare/bind/first/all/run/batch surface the service calls.
// D1 enforces foreign keys, so this turns them on too. Each service's `test-sqlite-d1.ts` wraps it in its own env.
// Not a `.test.ts` file, so vitest doesn't collect it as a suite.
//
// D1 refuses a compound SELECT of more than five terms, where node:sqlite allows 500, so every statement and
// migration passes the guard first; and it refuses a statement with more than 100 bound parameters, where
// node:sqlite allows 32,766, so a bind of more is refused as D1 would.

import { readdirSync, readFileSync } from 'node:fs';
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { assertD1Compound } from '../d1-compound-guard';

const D1_BOUND_PARAMETERS_MAX = 100;

// D1 binds a boolean as 1 / 0; node:sqlite refuses one outright.
function toSql(value: unknown): SQLInputValue {
  if (typeof value === 'boolean') return value ? 1 : 0;
  if (value === undefined) throw new TypeError('D1_TYPE_ERROR: undefined is not a bindable value');
  return value as SQLInputValue;
}

/** The service's D1 binding, and the raw handle, for arranging rows and asserting on them directly. */
export function serviceD1(migrationsDir: string): { db: D1Database; sql: DatabaseSync } {
  const sql = new DatabaseSync(':memory:');
  sql.exec('PRAGMA foreign_keys = ON');
  for (const file of readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort()) {
    const migration = readFileSync(migrationsDir + file, 'utf8');
    assertD1Compound(migration);
    sql.exec(migration);
  }

  const statement = (query: string, args: SQLInputValue[]) => {
    assertD1Compound(query);
    const rows = () =>
      sql
        .prepare(query)
        .all(...args)
        .map((row) => ({ ...row }));
    return {
      bind: (...next: unknown[]) => {
        if (next.length > D1_BOUND_PARAMETERS_MAX) {
          throw new Error('D1_ERROR: too many SQL variables: SQLITE_ERROR');
        }
        return statement(query, next.map(toSql));
      },
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
  return { db: db as unknown as D1Database, sql };
}
