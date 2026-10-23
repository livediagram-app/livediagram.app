// Tests only: node:sqlite behind the slice of a Durable Object's `SqlStorage` the kit uses.
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import type { SqlExec } from './outbox';

export function nodeSql(db = new DatabaseSync(':memory:')): SqlExec & { db: DatabaseSync } {
  return {
    db,
    exec(query: string, ...bindings: unknown[]) {
      const statement = db.prepare(query);
      const args = bindings.map((b) => (typeof b === 'boolean' ? Number(b) : b) as SQLInputValue);
      if (statement.columns().length === 0) {
        statement.run(...args);
        return { toArray: () => [] };
      }
      const rows = statement.all(...args).map((row) => ({ ...row }));
      return { toArray: () => rows };
    },
  };
}
