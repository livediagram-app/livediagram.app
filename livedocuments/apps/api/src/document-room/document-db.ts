// A document's own SQLite behind the D1 surface (docs/specs/015-api/api.md "Storage"). The content modules
// (db/tabs.ts, db/tab-stats.ts, db/image-refs.ts, db/changesets.ts, ...) were written against D1's
// prepare/bind/first/all/run/batch; inside the document's Durable Object they run unchanged against
// `ctx.storage.sql` through this adapter, as `env.DOCUMENT_DB`.
//
// What it keeps of D1's behaviour, because the modules rely on it:
//   - `batch` is atomic: it runs inside `transactionSync`, so a throw (the `tab_rev_stale` trigger's abort, a
//     constraint) rolls the whole batch back, as D1 does.
//   - `run().meta.changes` is SQLite's `changes()` for a write, 0 for a read.
//   - a boolean binds as 1 / 0 and `undefined` is refused, as D1 does.
// Every call is synchronous underneath (the Durable Object's SQLite is in-process); the promises are D1's shape.

// The slice of `SqlStorage` this uses, so a test can hand it node:sqlite (test-document-room.ts).
export type DocumentSql = {
  exec(query: string, ...bindings: unknown[]): DocumentSqlCursor;
};
export type DocumentSqlCursor = {
  toArray(): Record<string, unknown>[];
  readonly columnNames: string[];
};

export type DocumentDbHooks = {
  // Runs `fn` as one transaction (DurableObjectStorage.transactionSync).
  transaction: <T>(fn: () => T) => T;
  // Before the first statement: the schema, made on first use (document-schema.ts).
  ensureSchema: () => void;
  // After every statement that may have written: the room arms its outbox flush (document-room.ts).
  onWrite: () => void;
};

type Bindable = string | number | null | ArrayBuffer;

function toSql(value: unknown): Bindable {
  if (typeof value === 'boolean') return value ? 1 : 0;
  if (value === undefined) throw new TypeError('D1_TYPE_ERROR: undefined is not a bindable value');
  return value as Bindable;
}

type Meta = { changes: number; rows_read?: number; rows_written?: number };
type Result = { results: Record<string, unknown>[]; success: true; meta: Meta };

class DocumentStatement {
  private readonly db: DocumentDb;
  readonly query: string;
  readonly args: Bindable[];

  constructor(db: DocumentDb, query: string, args: Bindable[] = []) {
    this.db = db;
    this.query = query;
    this.args = args;
  }

  bind(...values: unknown[]): DocumentStatement {
    return new DocumentStatement(this.db, this.query, values.map(toSql));
  }

  async first<T = Record<string, unknown>>(column?: string): Promise<T | null> {
    const row = this.db.execute(this).results[0] ?? null;
    if (column) return (row ? (row[column] ?? null) : null) as T | null;
    return row as T | null;
  }

  async all<T = Record<string, unknown>>(): Promise<{ results: T[]; success: true; meta: Meta }> {
    return this.db.execute(this) as { results: T[]; success: true; meta: Meta };
  }

  async run(): Promise<Result> {
    return this.db.execute(this);
  }

  async raw<T = unknown[]>(): Promise<T[]> {
    const { results } = this.db.execute(this);
    return results.map((r) => Object.values(r)) as T[];
  }
}

export class DocumentDb {
  private readonly sql: DocumentSql;
  private readonly hooks: DocumentDbHooks;

  constructor(sql: DocumentSql, hooks: DocumentDbHooks) {
    this.sql = sql;
    this.hooks = hooks;
  }

  prepare(query: string): DocumentStatement {
    return new DocumentStatement(this, query);
  }

  // One transaction for the whole batch, as D1. The results are D1's: a read's rows, a write's change count.
  async batch(statements: DocumentStatement[]): Promise<Result[]> {
    this.hooks.ensureSchema();
    const results = this.hooks.transaction(() => statements.map((s) => this.executeOne(s)));
    this.hooks.onWrite();
    return results;
  }

  async exec(query: string): Promise<{ count: number; duration: number }> {
    this.hooks.ensureSchema();
    this.sql.exec(query);
    this.hooks.onWrite();
    return { count: 1, duration: 0 };
  }

  execute(statement: DocumentStatement): Result {
    this.hooks.ensureSchema();
    const result = this.executeOne(statement);
    if (result.meta.changes > 0 || mayWrite(statement.query)) this.hooks.onWrite();
    return result;
  }

  // `total_changes()` moves only when a statement (or a trigger it fired) wrote, so a read costs no
  // `changes()` lookup and a read never reports the previous write's count.
  private executeOne(statement: DocumentStatement): Result {
    const before = this.totalChanges();
    const cursor = this.sql.exec(statement.query, ...statement.args);
    const results = cursor.toArray();
    const wrote = this.totalChanges() !== before;
    const changes = wrote ? Number(this.sql.exec('SELECT changes() AS n').toArray()[0]?.n ?? 0) : 0;
    return { results, success: true, meta: { changes } };
  }

  private totalChanges(): number {
    return Number(this.sql.exec('SELECT total_changes() AS n').toArray()[0]?.n ?? 0);
  }

  // The D1 type the content modules are written against.
  asD1(): D1Database {
    return this as unknown as D1Database;
  }
}

// A statement whose text starts as a write: the room hears about it even when it changed nothing, which
// costs it only a flag check.
function mayWrite(query: string): boolean {
  return /^\s*(INSERT|UPDATE|DELETE|REPLACE|WITH)\b/i.test(query);
}
