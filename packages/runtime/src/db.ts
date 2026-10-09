// The database the application talks to, expressed as the subset of the D1 API
// the api worker actually uses. Two properties follow from writing it that way:
//
//   - the Cloudflare runtime is a pass-through (`{ db: env.DB }`), which is what
//     keeps Phase 0 of plans/0001-self-hosted-runtime.md a pure refactor;
//   - the Node runtime only has to answer the same questions over `node:sqlite`.
//
// Nothing here imports `@cloudflare/workers-types`: the seam has to compile for
// both runtimes (docs/specs/016-platform/self-hosted-runtime.md).

/**
 * What a write reports back. `changes` is the field call sites read (the
 * account deletion and changeset counters in apps/api/src/db/account.ts read it
 * without a fallback), so it is required exactly as D1 requires it; the rest
 * stay optional because the Node runtime cannot promise D1's bookkeeping.
 */
export type DbMeta = {
  changes: number;
  last_row_id?: number;
  duration?: number;
  rows_read?: number;
  rows_written?: number;
};

export type DbResult<T = unknown> = {
  results: T[];
  success: boolean;
  meta: DbMeta;
};

/**
 * A prepared statement. `first`, `all` and `run` mirror D1's own signatures so
 * that a `D1PreparedStatement` satisfies this type without an adapter.
 */
export type DbStatement = {
  bind(...values: unknown[]): DbStatement;
  first<T = unknown>(): Promise<T | null>;
  all<T = unknown>(): Promise<DbResult<T>>;
  run(): Promise<{ success: boolean; meta: DbMeta }>;
};

export type Db = {
  prepare(query: string): DbStatement;
  batch<T = unknown>(statements: DbStatement[]): Promise<DbResult<T>[]>;
  exec(query: string): Promise<{ count: number; duration: number }>;
};
