// The SQL the plan writes for each new-side database (docs/migration.md "Writing without overwriting"), chunked
// for `wrangler d1 execute --remote --file`.
//
// Every row is keyed by its old id and written one of three ways, decided by the ledger (what an earlier run wrote):
// - never written: `INSERT OR IGNORE`, batched many rows to a statement, so a row the new side already holds under
//   that key is left alone (verify reports it);
// - written before and unchanged since: nothing at all;
// - written before and changed on the old side: with a `guard`, one `INSERT … ON CONFLICT … DO UPDATE … WHERE
//   <row>.<guard> = <the value the ledger says was written>`, so a row someone changed on the new side since is
//   left alone; without one, the row is insert-only and the change is counted in the report, never written.
// A `merge` clause instead writes the row with `ON CONFLICT DO UPDATE SET <merge>`, for the few tables where that is
// safe over any row (filling stamps that are still empty, adding an opt-out the row doesn't have).
// Nothing is ever deleted.
//
// Batches stay in each database's table order (parents before the rows that point at them), so every foreign key
// already holds when its row is written, whether or not D1 runs a file as one transaction.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export type Db = 'accounts' | 'index' | 'media' | 'community';
export const DBS: readonly Db[] = ['accounts', 'index', 'media', 'community'];

export type SqlValue = string | number | boolean | null | { raw: string };

/** A value as a SQLite literal. Strings are quoted with their quotes doubled; numbers must be finite. */
export function literal(value: SqlValue): string {
  if (value === null) return 'NULL';
  if (typeof value === 'boolean') return value ? '1' : '0';
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error(`Not a finite number: ${value}`);
    return String(value);
  }
  if (typeof value === 'object') return value.raw;
  return `'${value.replaceAll("'", "''")}'`;
}

/** What an earlier run wrote: a row's version as JSON text, or undefined when it was never written. */
export interface LedgerView {
  version(
    db: Db | 'rooms' | 'people' | 'r2' | 'kv',
    table: string,
    key: string,
  ): string | undefined;
}

export const EMPTY_LEDGER: LedgerView = { version: () => undefined };

/** One ledger row the apply step records once the statement that wrote it has run. */
export type LedgerEntry = [table: string, key: string, version: string];

export type RowSpec = {
  table: string;
  /** The ledger key: the row's old id (or its natural key joined with `|`). */
  key: string;
  columns: readonly string[];
  values: readonly SqlValue[];
  /** The conflict target (the table's primary key or a unique index's columns). */
  conflict: readonly string[];
  /** What the row is now on the old side: compared with the ledger to tell a change. */
  version: string | number | null;
  /** The column a catch-up compares with the ledger's value before rewriting the row. */
  guard?: string;
  /** The columns a guarded catch-up rewrites (default: every column but the conflict target's). */
  update?: readonly string[];
  /** A `DO UPDATE SET` clause safe over any row: used instead of `INSERT OR IGNORE`. */
  merge?: string;
  /** A statement each batch holding this row runs first (the accounts' team_seq bump). */
  before?: string;
};

// D1 takes statements up to 100 KB, and SQLite a VALUES list up to 500 rows: batches stay well inside both.
export const BATCH_ROWS = 100;
export const BATCH_BYTES = 90_000;
// A chunk file stays a few MB, so one `wrangler d1 execute --file` is quick to retry.
export const CHUNK_STATEMENTS = 5_000;
export const CHUNK_BYTES = 6_000_000;

type Batch = {
  head: string;
  tail: string;
  before: string | undefined;
  order: number;
  rows: string[];
  bytes: number;
  entries: LedgerEntry[];
};

export type TableCounts = {
  inserted: number;
  updated: number;
  unchanged: number;
  /** Changed on the old side since the last run, in a table that is only ever inserted: not written. */
  changedNotWritten: number;
};

export class SqlWriter {
  readonly files: string[] = [];
  readonly counts = new Map<string, TableCounts>();
  private readonly batches = new Map<string, Batch>();
  private chunk: string[] = [];
  private chunkBytes = 0;
  private chunkEntries: LedgerEntry[] = [];
  private readonly db: Db;
  private readonly bundleDir: string;
  private readonly ledger: LedgerView;
  private readonly order: readonly string[];

  constructor(db: Db, bundleDir: string, ledger: LedgerView, tableOrder: readonly string[]) {
    this.db = db;
    this.bundleDir = bundleDir;
    this.ledger = ledger;
    this.order = tableOrder;
  }

  private countsOf(table: string): TableCounts {
    let c = this.counts.get(table);
    if (!c) {
      c = { inserted: 0, updated: 0, unchanged: 0, changedNotWritten: 0 };
      this.counts.set(table, c);
    }
    return c;
  }

  private orderOf(table: string): number {
    const at = this.order.indexOf(table);
    if (at < 0) throw new Error(`${this.db}: table ${table} has no place in the write order`);
    return at;
  }

  /** What the ledger says an earlier run wrote for a row (its version as JSON), or undefined. */
  prior(table: string, key: string): string | undefined {
    return this.ledger.version(this.db, table, key);
  }

  /** Writes one row the way the ledger calls for. */
  row(spec: RowSpec): void {
    if (spec.columns.length !== spec.values.length) {
      throw new Error(
        `${spec.table}: ${spec.columns.length} columns, ${spec.values.length} values`,
      );
    }
    const version = JSON.stringify(spec.version);
    const prior = this.ledger.version(this.db, spec.table, spec.key);
    const counts = this.countsOf(spec.table);
    if (prior === version) {
      counts.unchanged++;
      return;
    }
    const entry: LedgerEntry = [spec.table, spec.key, version];
    const values = `(${spec.values.map(literal).join(', ')})`;
    const cols = spec.columns.join(', ');
    if (prior !== undefined && spec.guard) {
      const update = spec.update ?? spec.columns.filter((c) => !spec.conflict.includes(c));
      const set = update.map((c) => `${c} = excluded.${c}`).join(', ');
      const statement =
        `INSERT OR IGNORE INTO ${spec.table} (${cols}) VALUES ${values} ` +
        `ON CONFLICT (${spec.conflict.join(', ')}) DO UPDATE SET ${set} ` +
        `WHERE ${spec.table}.${spec.guard} = ${literal(JSON.parse(prior) as SqlValue)}`;
      this.flushUpTo(this.orderOf(spec.table));
      if (spec.before) this.statement(spec.before, []);
      this.statement(statement, [entry]);
      counts.updated++;
      return;
    }
    if (prior !== undefined && !spec.merge) {
      counts.changedNotWritten++;
      return;
    }
    // OR IGNORE with a merge too: a row that would break another unique index (an email already in the team) is
    // skipped rather than failing the file.
    const head = `INSERT OR IGNORE INTO ${spec.table} (${cols}) VALUES `;
    const tail = spec.merge
      ? ` ON CONFLICT (${spec.conflict.join(', ')}) DO UPDATE SET ${spec.merge}`
      : '';
    const batchKey = `${head}|${tail}|${spec.before ?? ''}`;
    let batch = this.batches.get(batchKey);
    const rowBytes = Buffer.byteLength(values) + 2;
    if (batch && (batch.rows.length >= BATCH_ROWS || batch.bytes + rowBytes > BATCH_BYTES)) {
      this.flushBatch(batchKey);
      batch = undefined;
    }
    if (!batch) {
      batch = {
        head,
        tail,
        before: spec.before,
        order: this.orderOf(spec.table),
        rows: [],
        bytes: Buffer.byteLength(head) + Buffer.byteLength(tail),
        entries: [],
      };
      this.batches.set(batchKey, batch);
    }
    batch.rows.push(values);
    batch.bytes += rowBytes;
    batch.entries.push(entry);
    if (prior === undefined) counts.inserted++;
    else counts.updated++;
  }

  /** A statement of its own (a revocation), after every batch of a table at or before `table`. */
  raw(table: string, statement: string, entries: LedgerEntry[]): void {
    this.flushUpTo(this.orderOf(table));
    this.statement(statement, entries);
    this.countsOf(table).updated += entries.length;
  }

  private flushUpTo(order: number): void {
    const due = [...this.batches.entries()]
      .filter(([, b]) => b.order <= order)
      .sort((a, b) => a[1].order - b[1].order);
    for (const [key] of due) this.flushBatch(key);
  }

  private flushBatch(key: string): void {
    const batch = this.batches.get(key);
    if (!batch) return;
    this.batches.delete(key);
    // Anything a row of this batch points at is written first.
    this.flushUpTo(batch.order - 1);
    if (batch.before) this.statement(batch.before, []);
    this.statement(`${batch.head}${batch.rows.join(',\n  ')}${batch.tail}`, batch.entries);
  }

  private statement(sql: string, entries: LedgerEntry[]): void {
    const bytes = Buffer.byteLength(sql) + 2;
    if (bytes > 100_000)
      throw new Error(`${this.db}: a statement of ${bytes} bytes is over D1's limit`);
    if (
      this.chunk.length > 0 &&
      (this.chunk.length >= CHUNK_STATEMENTS || this.chunkBytes + bytes > CHUNK_BYTES)
    ) {
      this.writeChunk();
    }
    this.chunk.push(`${sql};`);
    this.chunkBytes += bytes;
    for (const e of entries) this.chunkEntries.push(e);
  }

  private writeChunk(): void {
    if (this.chunk.length === 0) return;
    const n = String(this.files.length + 1).padStart(4, '0');
    const rel = `sql/${this.db}/${n}.sql`;
    mkdirSync(join(this.bundleDir, 'sql', this.db), { recursive: true });
    mkdirSync(join(this.bundleDir, 'ledger', this.db), { recursive: true });
    const header =
      `-- ${this.db} ${n}, written by @liveworkspace/migrate plan (docs/migration.md "Tooling").\n` +
      `-- Run by \`migrate apply\`, in order; every statement is safe to run again.\n` +
      `PRAGMA defer_foreign_keys = true;\n`;
    writeFileSync(join(this.bundleDir, rel), `${header}${this.chunk.join('\n')}\n`);
    writeFileSync(
      join(this.bundleDir, 'ledger', this.db, `${n}.jsonl`),
      this.chunkEntries.map((e) => JSON.stringify(e)).join('\n') +
        (this.chunkEntries.length ? '\n' : ''),
    );
    this.files.push(rel);
    this.chunk = [];
    this.chunkBytes = 0;
    this.chunkEntries = [];
  }

  /** Writes what is left. Returns the chunk files, in the order they run. */
  close(): string[] {
    this.flushUpTo(Number.MAX_SAFE_INTEGER);
    this.writeChunk();
    return this.files;
  }
}
