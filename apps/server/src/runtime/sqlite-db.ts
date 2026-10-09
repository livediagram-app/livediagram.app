import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import type { Db, DbResult, DbMeta, DbStatement } from '@livediagram/runtime';

// D1's interface over `node:sqlite` for the self-hosted runtime
// (docs/specs/016-platform/blueprints/self-hosted-runtime.md, "Node runtime: the
// database").
//
// Two differences from a naive adapter:
//
//   - **WAL, foreign keys, a busy timeout.** D1 enforces foreign keys and
//     serialises writers; the Node runtime has to ask for both. `busy_timeout`
//     turns a contended write into a short wait rather than an immediate
//     SQLITE_BUSY.
//   - **A write queue.** SQLite takes one writer at a time. Requests arrive
//     concurrently, so writes queue behind each other here instead of racing
//     into SQLITE_BUSY — the same reason tests/test-sqlite-d1.ts queues batches.
//
// `node:sqlite` is synchronous, so a statement blocks the event loop for its
// duration. That is the deliberate trade for a single-box deployment: the
// alternative (a worker thread or a native async driver) buys concurrency this
// spec does not target.

/** D1's own default: a statement that fails every read and write. */
const D1_TYPE_ERROR = 'D1_TYPE_ERROR: undefined is not a bindable value';

// D1 binds a boolean as 1 / 0; node:sqlite refuses one outright.
function toSql(value: unknown): SQLInputValue {
  if (typeof value === 'boolean') return value ? 1 : 0;
  if (value === undefined) throw new TypeError(D1_TYPE_ERROR);
  return value as SQLInputValue;
}

type SqliteStatement = DbStatement & { batchResult(): Promise<DbResult> };

export type SqliteDb = {
  db: Db;
  /** The raw handle, for the migration runner and for tests. */
  sql: DatabaseSync;
  /** Resolves when every queued write has landed. */
  settle(): Promise<void>;
  close(): void;
};

export function openSqliteDb(path: string): SqliteDb {
  const sql = new DatabaseSync(path);
  sql.exec('PRAGMA journal_mode = WAL');
  sql.exec('PRAGMA busy_timeout = 5000');
  sql.exec('PRAGMA foreign_keys = ON');
  sql.exec('PRAGMA synchronous = NORMAL');

  // One writer at a time: every mutation joins the tail of this chain.
  let writes: Promise<unknown> = Promise.resolve();
  const enqueue = <T>(run: () => T | Promise<T>): Promise<T> => {
    const next = writes.then(run, run);
    writes = next.catch(() => undefined);
    return next;
  };

  const rowsOf = (query: string, args: SQLInputValue[]): Record<string, unknown>[] =>
    sql
      .prepare(query)
      .all(...args)
      .map((row) => ({ ...row }));

  const statement = (query: string, args: SQLInputValue[]): SqliteStatement => {
    const read = (): DbResult => ({
      results: rowsOf(query, args),
      success: true,
      meta: { changes: 0 },
    });
    const write = (): DbResult => {
      const res = sql.prepare(query).run(...args);
      const meta: DbMeta = {
        changes: Number(res.changes),
        last_row_id: Number(res.lastInsertRowid),
      };
      return { results: [], success: true, meta };
    };
    const isRead = (): boolean => sql.prepare(query).columns().length > 0;
    return {
      bind: (...next: unknown[]) => statement(query, next.map(toSql)),
      first: async <T = unknown>() => {
        const row = rowsOf(query, args)[0] ?? null;
        return row as T | null;
      },
      all: async <T = unknown>() => read() as DbResult<T>,
      run: async () =>
        enqueue(() => {
          const result = write();
          return { success: result.success, meta: result.meta };
        }),
      // Only \`batch\` calls this, and \`batch\` already holds the write slot:
      // enqueueing here would make the queue wait on itself.
      batchResult: async () => (isRead() ? read() : write()),
    };
  };

  const db: Db = {
    prepare: (query: string) => statement(query, []),
    // D1 runs a batch as one transaction: all of it lands or none of it does.
    batch: async <T = unknown>(statements: DbStatement[]) =>
      enqueue(async () => {
        sql.exec('BEGIN');
        try {
          const results: DbResult[] = [];
          for (const statement of statements) {
            const one = statement as Partial<SqliteStatement>;
            if (!one.batchResult) {
              // A statement from another runtime: refusing loudly beats writing
              // half a transaction and reporting success.
              throw new TypeError('batch() takes statements prepared by this runtime');
            }
            results.push(await one.batchResult());
          }
          sql.exec('COMMIT');
          return results as DbResult<T>[];
        } catch (err) {
          sql.exec('ROLLBACK');
          throw err;
        }
      }),
    exec: async (query: string) => {
      await enqueue(() => {
        sql.exec(query);
        return undefined;
      });
      return { count: 1, duration: 0 };
    },
  };

  return {
    db,
    sql,
    settle: () => writes.then(() => undefined),
    close: () => sql.close(),
  };
}
