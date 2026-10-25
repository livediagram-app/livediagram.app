// The ledger (docs/migration.md "Writing without overwriting"): a local SQLite file kept with the bundles, holding
// what every earlier apply wrote, row by row, with the version it wrote. `plan` reads it to write only what changed
// and to guard every rewrite; `apply` adds to it after each file, room, image and KV batch succeeds, so a stopped
// run picks up where it left off.
//
// A bundle is planned against one generation of the ledger and applies only to that one (or resumes the apply it
// started), so a stale bundle can never be applied over a newer run's rows.
import { existsSync } from 'node:fs';
import { DatabaseSync, type StatementSync } from 'node:sqlite';
import type { LedgerView } from './sql.ts';

const SCHEMA = `
CREATE TABLE IF NOT EXISTS rows (
  db      TEXT NOT NULL,
  tbl     TEXT NOT NULL,
  key     TEXT NOT NULL,
  -- The version written, as JSON (a number stays a number).
  version TEXT NOT NULL,
  PRIMARY KEY (db, tbl, key)
) WITHOUT ROWID;
CREATE TABLE IF NOT EXISTS applied (
  bundle  TEXT NOT NULL,
  unit    TEXT NOT NULL,
  done_at INTEGER NOT NULL,
  PRIMARY KEY (bundle, unit)
) WITHOUT ROWID;
CREATE TABLE IF NOT EXISTS meta (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
) WITHOUT ROWID;
`;

export type LedgerRow = [db: string, table: string, key: string, version: string];

export class Ledger implements LedgerView {
  private readonly db: DatabaseSync;
  private readonly get: StatementSync;
  private readonly put: StatementSync;

  private constructor(db: DatabaseSync) {
    this.db = db;
    this.get = db.prepare('SELECT version FROM rows WHERE db = ? AND tbl = ? AND key = ?');
    this.put = db.prepare(
      `INSERT INTO rows (db, tbl, key, version) VALUES (?, ?, ?, ?)
       ON CONFLICT (db, tbl, key) DO UPDATE SET version = excluded.version`,
    );
  }

  /** Opens (or, for apply, creates) the ledger. `null` is an empty ledger in memory: a first run. */
  static open(path: string | null, options: { create?: boolean } = {}): Ledger {
    if (path === null) {
      const db = new DatabaseSync(':memory:');
      db.exec(SCHEMA);
      return new Ledger(db);
    }
    if (!existsSync(path) && !options.create) throw new Error(`No ledger at ${path}`);
    const db = new DatabaseSync(path);
    db.exec(SCHEMA);
    return new Ledger(db);
  }

  version(db: string, table: string, key: string): string | undefined {
    const row = this.get.get(db, table, key) as { version: string } | undefined;
    return row?.version;
  }

  private meta(key: string): string | null {
    const row = this.db.prepare('SELECT value FROM meta WHERE key = ?').get(key) as
      { value: string } | undefined;
    return row?.value ?? null;
  }

  private setMeta(key: string, value: string | null): void {
    if (value === null) this.db.prepare('DELETE FROM meta WHERE key = ?').run(key);
    else
      this.db
        .prepare(
          'INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value',
        )
        .run(key, value);
  }

  /** How many applies have finished: a bundle is planned against one generation. */
  generation(): number {
    return Number(this.meta('generation') ?? '0');
  }

  /** The bundle whose apply started and hasn't finished, if any. */
  inProgress(): string | null {
    return this.meta('in_progress');
  }

  /** Starts (or resumes) applying a bundle planned at `generation`. */
  begin(bundle: string, generation: number): void {
    const open = this.inProgress();
    if (open && open !== bundle) {
      throw new Error(`The ledger is in the middle of applying bundle ${open}: finish that first`);
    }
    if (!open && generation !== this.generation()) {
      throw new Error(
        `This bundle was planned at ledger generation ${generation}, the ledger is at ${this.generation()}: plan again`,
      );
    }
    this.setMeta('in_progress', bundle);
  }

  finish(bundle: string): void {
    if (this.inProgress() !== bundle) throw new Error(`Bundle ${bundle} is not being applied`);
    this.db.exec('BEGIN');
    this.setMeta('generation', String(this.generation() + 1));
    this.setMeta('in_progress', null);
    this.db.exec('COMMIT');
  }

  isDone(bundle: string, unit: string): boolean {
    return !!this.db
      .prepare('SELECT 1 FROM applied WHERE bundle = ? AND unit = ?')
      .get(bundle, unit);
  }

  /** Records a unit (a SQL file, a room, an image) as written, with the rows it wrote, in one transaction. */
  markDone(bundle: string, unit: string, rows: Iterable<LedgerRow>, now = Date.now()): void {
    this.db.exec('BEGIN');
    try {
      for (const [db, table, key, version] of rows) this.put.run(db, table, key, version);
      this.db
        .prepare('INSERT OR REPLACE INTO applied (bundle, unit, done_at) VALUES (?, ?, ?)')
        .run(bundle, unit, now);
      this.db.exec('COMMIT');
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }

  close(): void {
    this.db.close();
  }
}
