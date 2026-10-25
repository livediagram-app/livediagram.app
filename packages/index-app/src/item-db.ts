// An item's own SQLite behind the D1 surface, for an app whose items each live in a Durable Object (a plan, a
// document, a design). The app's content modules were written against D1's prepare/bind/first/all/run/batch;
// inside the item's Durable Object they run unchanged against `ctx.storage.sql` through this adapter, as the
// app's `env.<APP>_DB`.
//
// What it keeps of D1's behaviour, because the modules rely on it:
//   - `batch` is atomic: it runs inside `transactionSync`, so a throw (the `tab_rev_stale` trigger's abort, a
//     constraint) rolls the whole batch back, as D1 does.
//   - `run().meta.changes` is SQLite's `changes()` for a write, 0 for a read.
//   - a boolean binds as 1 / 0 and `undefined` is refused, as D1 does.
// Every call is synchronous underneath (the Durable Object's SQLite is in-process); the promises are D1's shape.
//
// `onWrite` runs only when a call changed a row (a statement or a trigger it fired: SQLite's `total_changes()`
// moved). The room counts those calls to tell a request that wrote from a read (its edit key for the Timeline
// and Most Used, outbox.ts recordItemEditor), so a read, a batch of reads, and a write that matched nothing call it
// never.

// The slice of `SqlStorage` this uses, so a test can hand it node:sqlite.
export type ItemSql = {
  exec(query: string, ...bindings: unknown[]): ItemSqlCursor;
};
export type ItemSqlCursor = {
  toArray(): Record<string, unknown>[];
  readonly columnNames: string[];
};

export type ItemDbHooks = {
  // Runs `fn` as one transaction (DurableObjectStorage.transactionSync).
  transaction: <T>(fn: () => T) => T;
  // Before the first statement: the item's schema, made on first use.
  ensureSchema: () => void;
  // After a call that changed a row: the room counts the write and arms its outbox flush.
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

class ItemStatement {
  private readonly db: ItemDb;
  readonly query: string;
  readonly args: Bindable[];

  constructor(db: ItemDb, query: string, args: Bindable[] = []) {
    this.db = db;
    this.query = query;
    this.args = args;
  }

  bind(...values: unknown[]): ItemStatement {
    return new ItemStatement(this.db, this.query, values.map(toSql));
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

export class ItemDb {
  private readonly sql: ItemSql;
  private readonly hooks: ItemDbHooks;

  constructor(sql: ItemSql, hooks: ItemDbHooks) {
    this.sql = sql;
    this.hooks = hooks;
  }

  prepare(query: string): ItemStatement {
    return new ItemStatement(this, query);
  }

  // One transaction for the whole batch, as D1. The results are D1's: a read's rows, a write's change count.
  async batch(statements: ItemStatement[]): Promise<Result[]> {
    this.hooks.ensureSchema();
    let wrote = false;
    const results = this.hooks.transaction(() =>
      statements.map((s) => {
        const one = this.executeOne(s);
        wrote ||= one.wrote;
        return one.result;
      }),
    );
    if (wrote) this.hooks.onWrite();
    return results;
  }

  async exec(query: string): Promise<{ count: number; duration: number }> {
    this.hooks.ensureSchema();
    const before = this.totalChanges();
    this.sql.exec(query);
    if (this.totalChanges() !== before) this.hooks.onWrite();
    return { count: 1, duration: 0 };
  }

  execute(statement: ItemStatement): Result {
    this.hooks.ensureSchema();
    const { result, wrote } = this.executeOne(statement);
    if (wrote) this.hooks.onWrite();
    return result;
  }

  // `total_changes()` moves only when a statement (or a trigger it fired) wrote, so a read costs no
  // `changes()` lookup and a read never reports the previous write's count.
  private executeOne(statement: ItemStatement): { result: Result; wrote: boolean } {
    const before = this.totalChanges();
    const cursor = this.sql.exec(statement.query, ...statement.args);
    const results = cursor.toArray();
    const wrote = this.totalChanges() !== before;
    const changes = wrote ? Number(this.sql.exec('SELECT changes() AS n').toArray()[0]?.n ?? 0) : 0;
    return { result: { results, success: true, meta: { changes } }, wrote };
  }

  private totalChanges(): number {
    return Number(this.sql.exec('SELECT total_changes() AS n').toArray()[0]?.n ?? 0);
  }

  // The D1 type the content modules are written against.
  asD1(): D1Database {
    return this as unknown as D1Database;
  }
}
