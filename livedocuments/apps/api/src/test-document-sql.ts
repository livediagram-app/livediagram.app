import type { DatabaseSync, SQLInputValue } from 'node:sqlite';
import type { ItemSql, ItemSqlCursor } from '@liveworkspace/index-app';

// `ctx.storage.sql` for node tests: SqlStorage's `exec` over a node:sqlite database, for the document's SQLite
// (@liveworkspace/index-app item-db.ts) and the document schema's migration. Like SqlStorage, a call without
// bindings may hold several statements (the schema); a call with bindings is one statement. Not a `.test.ts`
// file, so vitest doesn't collect it as a suite.

function toNode(value: unknown): SQLInputValue {
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  return value as SQLInputValue;
}

// More than one statement: a `;` with anything but whitespace after it.
function isScript(query: string): boolean {
  const end = query.trimEnd().replace(/;$/, '');
  return end.includes(';');
}

export function nodeDocumentSql(db: DatabaseSync): ItemSql {
  return {
    exec(query: string, ...bindings: unknown[]): ItemSqlCursor {
      if (bindings.length === 0 && isScript(query)) {
        db.exec(query);
        return { toArray: () => [], columnNames: [] };
      }
      const statement = db.prepare(query);
      const columnNames = statement.columns().map((c) => c.name);
      const args = bindings.map(toNode);
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
    const name = `document_tx_${depth++}`;
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
