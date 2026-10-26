// Tests only: node:sqlite behind the slice of a Durable Object's `SqlStorage` the kit uses. A Durable Object's SQLite
// has D1's query limits, so each stand-in refuses a compound SELECT of more than five terms, as production would.
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { assertD1Compound } from '@liveworkspace/api-kit/d1-compound-guard';
import type { ItemSql, ItemSqlCursor } from './item-db';
import type { SqlExec } from './outbox';

export function nodeSql(db = new DatabaseSync(':memory:')): SqlExec & { db: DatabaseSync } {
  return {
    db,
    exec(query: string, ...bindings: unknown[]) {
      assertD1Compound(query);
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
      assertD1Compound(query);
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

/**
 * A Durable Object's state for an app's node tests of one item's room: its SQLite on node:sqlite (foreign keys on, as
 * in production), an in-memory key-value store, no sockets and no alarm. `transactions` counts the
 * `transactionSync` calls, for a test that holds a write to one transaction.
 */
export function nodeDurableState(name: string, db = new DatabaseSync(':memory:')) {
  db.exec('PRAGMA foreign_keys = ON');
  const store = new Map<string, unknown>();
  const transaction = nodeTransaction(db);
  const counter = { transactions: 0 };
  const state = {
    id: { name, equals: (other: { name?: string }) => other?.name === name, toString: () => name },
    storage: {
      sql: nodeItemSql(db),
      transactionSync: <T>(fn: () => T): T => {
        counter.transactions += 1;
        return transaction(fn);
      },
      get: async (key: string) => store.get(key),
      put: async (key: string, value: unknown) => void store.set(key, value),
      delete: async (key: string) => store.delete(key),
      list: async ({ prefix }: { prefix: string }) =>
        new Map([...store].filter(([key]) => key.startsWith(prefix))),
      setAlarm: async () => {},
      getAlarm: async () => null,
      deleteAlarm: async () => {},
      deleteAll: async () => store.clear(),
    },
    acceptWebSocket: () => {},
    getWebSockets: () => [],
    blockConcurrencyWhile: async (fn: () => Promise<void>) => fn(),
    waitUntil: () => {},
  };
  return { state, db, counter };
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
