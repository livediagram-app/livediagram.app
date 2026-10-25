// Tests only: node:sqlite behind the slice of a Durable Object's `SqlStorage` the kit uses.
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import type { ItemSql, ItemSqlCursor } from './item-db';
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

// More than one statement: a `;` with anything but whitespace after it.
function isScript(query: string): boolean {
  const end = query.trimEnd().replace(/;$/, '');
  return end.includes(';');
}

/**
 * An item's `ctx.storage.sql` for an app's node tests: SqlStorage's `exec` over node:sqlite, for the item's own
 * SQLite (item-db.ts) and the app's schema migration. Like SqlStorage, a call without bindings may hold several
 * statements (the schema); a call with bindings is one statement, and an ArrayBuffer binds as a blob.
 */
export function nodeItemSql(db: DatabaseSync): ItemSql {
  return {
    exec(query: string, ...bindings: unknown[]): ItemSqlCursor {
      if (bindings.length === 0 && isScript(query)) {
        db.exec(query);
        return { toArray: () => [], columnNames: [] };
      }
      const statement = db.prepare(query);
      const columnNames = statement.columns().map((c) => c.name);
      const args = bindings.map((value) =>
        value instanceof ArrayBuffer ? new Uint8Array(value) : (value as SQLInputValue),
      );
      if (columnNames.length === 0) {
        statement.run(...args);
        return { toArray: () => [], columnNames };
      }
      const rows = statement.all(...args).map((row) => ({ ...row }));
      return { toArray: () => rows, columnNames };
    },
  };
}

// DurableObjectStorage.transactionSync over node:sqlite: a savepoint, so one may sit inside another.
let depth = 0;
export function nodeTransaction(db: DatabaseSync): <T>(fn: () => T) => T {
  return <T>(fn: () => T): T => {
    const name = `item_tx_${depth++}`;
    db.exec(`SAVEPOINT ${name}`);
    try {
      const result = fn();
      db.exec(`RELEASE ${name}`);
      return result;
    } catch (err) {
      db.exec(`ROLLBACK TO ${name}`);
      db.exec(`RELEASE ${name}`);
      throw err;
    } finally {
      depth--;
    }
  };
}
