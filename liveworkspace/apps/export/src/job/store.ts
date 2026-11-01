// The export object's SQLite (liveworkspace/docs/specs/003-accounts/blueprints/data-export.md "Data and persistence"):
// the job, the queue of items and images still to add, the zip's directory, the parts uploaded, the buffer's tail
// between chunks, the comments gathered and the items an app couldn't answer. One object per scope, its latest export.

import type {
  ExportPhase,
  ExportScope,
  ExportStatus,
  ExportView,
} from '@liveworkspace/data-export';
import type { App } from '@liveworkspace/index-client';
import type { CommentRow } from '../files';
import type { UploadedPart } from '../upload';
import type { ZipEntry } from '../zip/zip';

export type SqlRow = Record<string, unknown>;
export interface Sql {
  exec(query: string, ...bindings: unknown[]): { toArray(): SqlRow[] };
}

export type Job = {
  id: string;
  key: string;
  scope: ExportScope;
  requestedBy: string;
  status: ExportStatus;
  phase: ExportPhase | null;
  // The index list's next page (null: listing starts, or is done once phase moves on).
  cursor: string | null;
  itemsTotal: number;
  itemsDone: number;
  imagesTotal: number;
  imagesDone: number;
  // The zip's bytes so far: every part and the buffered tail.
  bytes: number;
  uploadId: string | null;
  nextPart: number;
  startedAt: number;
  finishedAt: number | null;
  expiresAt: number | null;
  failures: number;
  leftOut: number;
  problems: number;
  // Accounts has not heard yet that it finished (the email waits on it).
  notifyPending: boolean;
  profile: Record<string, unknown> | null;
};

export type QueueRow = {
  seq: number;
  kind: 'item' | 'image';
  app: App | null;
  ref: string;
  name: string;
  updatedAt: number;
  contentType: string | null;
};

export type Problem = { app: App; name: string; reason: string };

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS export_job (
     one INTEGER PRIMARY KEY CHECK (one = 1), id TEXT NOT NULL, key TEXT NOT NULL, scope TEXT NOT NULL,
     requested_by TEXT NOT NULL, status TEXT NOT NULL, phase TEXT, cursor TEXT, items_total INTEGER NOT NULL,
     items_done INTEGER NOT NULL, images_total INTEGER NOT NULL, images_done INTEGER NOT NULL, bytes INTEGER NOT NULL,
     upload_id TEXT, next_part INTEGER NOT NULL, started_at INTEGER NOT NULL, finished_at INTEGER, expires_at INTEGER,
     failures INTEGER NOT NULL, left_out INTEGER NOT NULL, problems INTEGER NOT NULL, notify_pending INTEGER NOT NULL,
     profile TEXT)`,
  `CREATE TABLE IF NOT EXISTS export_queue (seq INTEGER PRIMARY KEY, kind TEXT NOT NULL, app TEXT, ref TEXT NOT NULL,
     name TEXT NOT NULL, updated_at INTEGER NOT NULL, content_type TEXT, done INTEGER NOT NULL DEFAULT 0)`,
  `CREATE TABLE IF NOT EXISTS export_entries (seq INTEGER PRIMARY KEY, name TEXT NOT NULL, method INTEGER NOT NULL,
     crc INTEGER NOT NULL, compressed_size INTEGER NOT NULL, size INTEGER NOT NULL, offset INTEGER NOT NULL,
     time INTEGER NOT NULL, date INTEGER NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS export_parts (part_number INTEGER PRIMARY KEY, etag TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS export_buffer (seq INTEGER PRIMARY KEY, bytes BLOB NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS export_comments (seq INTEGER PRIMARY KEY, row TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS export_problems (seq INTEGER PRIMARY KEY, app TEXT NOT NULL, name TEXT NOT NULL,
     reason TEXT NOT NULL)`,
];

const WORK_TABLES = [
  'export_queue',
  'export_entries',
  'export_parts',
  'export_buffer',
  'export_comments',
  'export_problems',
];

// A SQLite value is at most 2 MB in a Durable Object: the buffer's tail is kept in pieces under that.
export const BUFFER_PIECE_BYTES = 1024 * 1024;

const num = (v: unknown): number => Number(v);
const str = (v: unknown): string | null => (typeof v === 'string' ? v : null);
// Workers hands a BLOB back as an ArrayBuffer, node:sqlite as a Uint8Array.
const bytesOf = (v: unknown): Uint8Array =>
  v instanceof Uint8Array ? v : new Uint8Array(v as ArrayBuffer);

function jobOf(row: SqlRow): Job {
  return {
    id: String(row.id),
    key: String(row.key),
    scope: JSON.parse(String(row.scope)) as ExportScope,
    requestedBy: String(row.requested_by),
    status: row.status as ExportStatus,
    phase: (str(row.phase) as ExportPhase | null) ?? null,
    cursor: str(row.cursor),
    itemsTotal: num(row.items_total),
    itemsDone: num(row.items_done),
    imagesTotal: num(row.images_total),
    imagesDone: num(row.images_done),
    bytes: num(row.bytes),
    uploadId: str(row.upload_id),
    nextPart: num(row.next_part),
    startedAt: num(row.started_at),
    finishedAt: row.finished_at === null ? null : num(row.finished_at),
    expiresAt: row.expires_at === null ? null : num(row.expires_at),
    failures: num(row.failures),
    leftOut: num(row.left_out),
    problems: num(row.problems),
    notifyPending: num(row.notify_pending) === 1,
    profile:
      row.profile === null ? null : (JSON.parse(String(row.profile)) as Record<string, unknown>),
  };
}

/** A job's state as the wire carries it. */
export function viewOf(job: Job): ExportView {
  return {
    id: job.id,
    status: job.status,
    phase: job.status === 'running' ? job.phase : null,
    requestedBy: job.requestedBy,
    startedAt: job.startedAt,
    finishedAt: job.finishedAt,
    expiresAt: job.expiresAt,
    itemsTotal: job.itemsTotal,
    itemsDone: job.itemsDone,
    imagesTotal: job.imagesTotal,
    imagesDone: job.imagesDone,
    bytes: job.bytes,
    leftOut: job.leftOut,
    problems: job.problems,
  };
}

/** The R2 key of an export's zip. */
export const objectKey = (key: string, id: string) => `exports/${key}/${id}.zip`;

export class JobStore {
  private readonly sql: Sql;

  constructor(sql: Sql) {
    this.sql = sql;
    for (const statement of SCHEMA) sql.exec(statement);
  }

  job(): Job | null {
    const row = this.sql.exec('SELECT * FROM export_job WHERE one = 1').toArray()[0];
    return row ? jobOf(row) : null;
  }

  /** A new export in place of whatever was here: the work tables emptied, the job written. */
  begin(job: Job): void {
    for (const table of WORK_TABLES) this.sql.exec(`DELETE FROM ${table}`);
    this.sql.exec('DELETE FROM export_job');
    this.sql.exec(
      `INSERT INTO export_job (one, id, key, scope, requested_by, status, phase, cursor, items_total, items_done,
         images_total, images_done, bytes, upload_id, next_part, started_at, finished_at, expires_at, failures,
         left_out, problems, notify_pending, profile)
       VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      job.id,
      job.key,
      JSON.stringify(job.scope),
      job.requestedBy,
      job.status,
      job.phase,
      job.cursor,
      job.itemsTotal,
      job.itemsDone,
      job.imagesTotal,
      job.imagesDone,
      job.bytes,
      job.uploadId,
      job.nextPart,
      job.startedAt,
      job.finishedAt,
      job.expiresAt,
      job.failures,
      job.leftOut,
      job.problems,
      job.notifyPending ? 1 : 0,
      job.profile === null ? null : JSON.stringify(job.profile),
    );
  }

  /** Writes the job's changing fields back. */
  save(job: Job): void {
    this.sql.exec(
      `UPDATE export_job SET status = ?, phase = ?, cursor = ?, items_total = ?, items_done = ?, images_total = ?,
         images_done = ?, bytes = ?, upload_id = ?, next_part = ?, finished_at = ?, expires_at = ?, failures = ?,
         left_out = ?, problems = ?, notify_pending = ? WHERE one = 1`,
      job.status,
      job.phase,
      job.cursor,
      job.itemsTotal,
      job.itemsDone,
      job.imagesTotal,
      job.imagesDone,
      job.bytes,
      job.uploadId,
      job.nextPart,
      job.finishedAt,
      job.expiresAt,
      job.failures,
      job.leftOut,
      job.problems,
      job.notifyPending ? 1 : 0,
    );
  }

  /** Empties the work tables: the export is finished, failed or gone, and only the job row stays. */
  clearWork(): void {
    for (const table of WORK_TABLES) this.sql.exec(`DELETE FROM ${table}`);
  }

  /** Every row gone, the job's too: the scope has no export (an account closing). */
  forget(): void {
    this.clearWork();
    this.sql.exec('DELETE FROM export_job');
  }

  enqueue(rows: readonly Omit<QueueRow, 'seq'>[]): void {
    for (const r of rows) {
      this.sql.exec(
        'INSERT INTO export_queue (kind, app, ref, name, updated_at, content_type) VALUES (?, ?, ?, ?, ?, ?)',
        r.kind,
        r.app,
        r.ref,
        r.name,
        r.updatedAt,
        r.contentType,
      );
    }
  }

  /** The next queued row of a kind after `afterSeq`, oldest first. */
  next(kind: QueueRow['kind'], afterSeq = 0): QueueRow | null {
    const row = this.sql
      .exec(
        'SELECT * FROM export_queue WHERE kind = ? AND done = 0 AND seq > ? ORDER BY seq LIMIT 1',
        kind,
        afterSeq,
      )
      .toArray()[0];
    if (!row) return null;
    return {
      seq: num(row.seq),
      kind: row.kind as QueueRow['kind'],
      app: (str(row.app) as App | null) ?? null,
      ref: String(row.ref),
      name: String(row.name),
      updatedAt: num(row.updated_at),
      contentType: str(row.content_type),
    };
  }

  markDone(seqs: readonly number[]): void {
    for (const seq of seqs) this.sql.exec('UPDATE export_queue SET done = 1 WHERE seq = ?', seq);
  }

  /** How many rows of a kind are still to do: what a cap leaves out. */
  remaining(kind: QueueRow['kind']): number {
    return num(
      this.sql
        .exec('SELECT COUNT(*) AS n FROM export_queue WHERE kind = ? AND done = 0', kind)
        .toArray()[0]?.n,
    );
  }

  addEntries(entries: readonly ZipEntry[]): void {
    for (const e of entries) {
      this.sql.exec(
        `INSERT INTO export_entries (name, method, crc, compressed_size, size, offset, time, date)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        e.name,
        e.method,
        e.crc,
        e.compressedSize,
        e.size,
        e.offset,
        e.time,
        e.date,
      );
    }
  }

  entries(): ZipEntry[] {
    return this.sql
      .exec('SELECT * FROM export_entries ORDER BY seq')
      .toArray()
      .map((r) => ({
        name: String(r.name),
        method: num(r.method) as ZipEntry['method'],
        crc: num(r.crc),
        compressedSize: num(r.compressed_size),
        size: num(r.size),
        offset: num(r.offset),
        time: num(r.time),
        date: num(r.date),
      }));
  }

  /** The files so far: count, and their names' bytes, for the caps. */
  entryStats(): { count: number; nameBytes: number } {
    const row = this.sql
      .exec(
        'SELECT COUNT(*) AS n, COALESCE(SUM(LENGTH(CAST(name AS BLOB))), 0) AS b FROM export_entries',
      )
      .toArray()[0];
    return { count: num(row?.n), nameBytes: num(row?.b) };
  }

  addParts(parts: readonly UploadedPart[]): void {
    for (const p of parts) {
      this.sql.exec(
        'INSERT OR REPLACE INTO export_parts (part_number, etag) VALUES (?, ?)',
        p.partNumber,
        p.etag,
      );
    }
  }

  parts(): UploadedPart[] {
    return this.sql
      .exec('SELECT * FROM export_parts ORDER BY part_number')
      .toArray()
      .map((r) => ({ partNumber: num(r.part_number), etag: String(r.etag) }));
  }

  saveTail(tail: Uint8Array): void {
    this.sql.exec('DELETE FROM export_buffer');
    for (let at = 0, seq = 0; at < tail.length; at += BUFFER_PIECE_BYTES, seq++) {
      // A copy, not a view: SQLite binds the whole underlying buffer of a view.
      this.sql.exec(
        'INSERT INTO export_buffer (seq, bytes) VALUES (?, ?)',
        seq,
        tail.slice(at, at + BUFFER_PIECE_BYTES),
      );
    }
  }

  tail(): Uint8Array {
    const pieces = this.sql
      .exec('SELECT bytes FROM export_buffer ORDER BY seq')
      .toArray()
      .map((r) => bytesOf(r.bytes));
    const out = new Uint8Array(pieces.reduce((n, p) => n + p.length, 0));
    let at = 0;
    for (const p of pieces) {
      out.set(p, at);
      at += p.length;
    }
    return out;
  }

  addComments(rows: readonly CommentRow[]): void {
    for (const r of rows)
      this.sql.exec('INSERT INTO export_comments (row) VALUES (?)', JSON.stringify(r));
  }

  comments(): CommentRow[] {
    return this.sql
      .exec('SELECT row FROM export_comments ORDER BY seq')
      .toArray()
      .map((r) => JSON.parse(String(r.row)) as CommentRow);
  }

  addProblems(problems: readonly Problem[]): void {
    for (const p of problems) {
      this.sql.exec(
        'INSERT INTO export_problems (app, name, reason) VALUES (?, ?, ?)',
        p.app,
        p.name,
        p.reason,
      );
    }
  }

  problems(): Problem[] {
    return this.sql
      .exec('SELECT app, name, reason FROM export_problems ORDER BY seq')
      .toArray()
      .map((r) => ({ app: r.app as App, name: String(r.name), reason: String(r.reason) }));
  }
}
