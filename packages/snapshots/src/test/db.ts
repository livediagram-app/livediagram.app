// Tests only: an item's SQLite behind the slice of the D1 surface the store uses, over node:sqlite, as each app's room
// hands it to its handlers. `batch` runs in one transaction, as D1's does.
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import type { SnapshotDb, SnapshotStatement } from '../store';

export function testDb(sql = new DatabaseSync(':memory:')): { db: SnapshotDb; sql: DatabaseSync } {
  sql.exec('PRAGMA foreign_keys = ON');
  const statement = (
    query: string,
    args: unknown[] = [],
  ): SnapshotStatement & { exec: () => unknown[] } => {
    const exec = () => {
      const prepared = sql.prepare(query);
      const values = args as SQLInputValue[];
      if (prepared.columns().length === 0) {
        prepared.run(...values);
        return [];
      }
      return prepared.all(...values).map((row) => ({ ...row }));
    };
    return {
      exec,
      bind: (...values) => statement(query, values),
      first: async <T>() => (exec()[0] as T | undefined) ?? null,
      all: async <T>() => ({ results: exec() as T[] }),
      run: async () => exec(),
    };
  };
  const db: SnapshotDb = {
    prepare: (query) => statement(query),
    batch: async (statements) => {
      sql.exec('BEGIN');
      try {
        const results = statements.map((s) => (s as ReturnType<typeof statement>).exec());
        sql.exec('COMMIT');
        return results;
      } catch (err) {
        sql.exec('ROLLBACK');
        throw err;
      }
    },
    exec: async (query) => sql.exec(query),
  };
  return { db, sql };
}
