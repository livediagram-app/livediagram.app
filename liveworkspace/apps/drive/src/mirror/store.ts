// A person's mirror state in their Durable Object's SQLite (liveworkspace/docs/specs/005-drive/drive.md "The service"):
// `drive_connection`, one row (the sealed refresh token, the root, the page token, status, the Google account, a
// pending switch, the push channel, back-off, pass progress), and `drive_items`, one row per mirrored item and folder
// (DriveRow, plus the item's updatedAt last seen, for the Explorer's marks). `drive_failures` holds the items whose
// last write failed. Over a minimal SQL interface, so the tests run it on node:sqlite.
//
// A store that never held anything gets no schema from a read: reads check for the schema first, so a signal or a
// marks request for someone not connected writes nothing.

import {
  isAppName,
  type Backoff,
  type DriveRow,
  type DriveRowKind,
  type DriveStatus,
} from '@liveworkspace/drive';

export interface SqlCursor {
  toArray(): Record<string, unknown>[];
}

export interface Sql {
  exec(query: string, ...bindings: unknown[]): SqlCursor;
}

export type Connection = {
  personId: string;
  sealedRefresh: string;
  googleAccount: string;
  connectedAt: number;
  status: DriveStatus;
  rootId: string | null;
  rootName: string | null;
  pageToken: string | null;
  pendingSealed: string | null;
  pendingAccount: string | null;
  pendingUntil: number | null;
  channelId: string | null;
  channelResource: string | null;
  channelExpiresAt: number | null;
  channelFailedAt: number | null;
  backoff: Backoff;
  // When the last pass ended (whatever its outcome), and the last that finished without an error.
  lastPassAt: number | null;
  lastSyncedAt: number | null;
  syncing: boolean;
  progress: { done: number; total: number } | null;
  // The next pass writes every changed item now (Check now).
  flushNext: boolean;
  pickerWindowStart: number | null;
  pickerCount: number;
};

export type StoredRow = DriveRow & { seenUpdatedAt: number | null };

const SCHEMA = `
CREATE TABLE IF NOT EXISTS drive_connection (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  person_id TEXT NOT NULL,
  sealed_refresh TEXT NOT NULL,
  google_account TEXT NOT NULL,
  connected_at INTEGER NOT NULL,
  status TEXT NOT NULL,
  root_id TEXT,
  root_name TEXT,
  page_token TEXT,
  pending_sealed TEXT,
  pending_account TEXT,
  pending_until INTEGER,
  channel_id TEXT,
  channel_resource TEXT,
  channel_expires_at INTEGER,
  channel_failed_at INTEGER,
  backoff_level INTEGER NOT NULL DEFAULT 0,
  backoff_error_at INTEGER,
  last_pass_at INTEGER,
  last_synced_at INTEGER,
  syncing INTEGER NOT NULL DEFAULT 0,
  progress_done INTEGER,
  progress_total INTEGER,
  flush_next INTEGER NOT NULL DEFAULT 0,
  picker_window_start INTEGER,
  picker_count INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS drive_items (
  kind TEXT NOT NULL,
  id TEXT NOT NULL,
  app TEXT,
  drive_file_id TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  parent_id TEXT,
  trashed INTEGER NOT NULL,
  md5 TEXT,
  head_revision_id TEXT,
  local_name TEXT NOT NULL,
  mirrored_updated_at INTEGER,
  content_written_at INTEGER,
  notice TEXT,
  notice_parent_id TEXT,
  seen_updated_at INTEGER,
  PRIMARY KEY (kind, id)
);
CREATE TABLE IF NOT EXISTS drive_failures (
  id TEXT PRIMARY KEY,
  at INTEGER NOT NULL
);
`;

// Connection fields and their columns; `backoff` and `progress` span two columns each.
const COLUMNS = {
  personId: 'person_id',
  sealedRefresh: 'sealed_refresh',
  googleAccount: 'google_account',
  connectedAt: 'connected_at',
  status: 'status',
  rootId: 'root_id',
  rootName: 'root_name',
  pageToken: 'page_token',
  pendingSealed: 'pending_sealed',
  pendingAccount: 'pending_account',
  pendingUntil: 'pending_until',
  channelId: 'channel_id',
  channelResource: 'channel_resource',
  channelExpiresAt: 'channel_expires_at',
  channelFailedAt: 'channel_failed_at',
  lastPassAt: 'last_pass_at',
  lastSyncedAt: 'last_synced_at',
  syncing: 'syncing',
  flushNext: 'flush_next',
  pickerWindowStart: 'picker_window_start',
  pickerCount: 'picker_count',
} as const satisfies Partial<Record<keyof Connection, string>>;

type Value = string | number | null;

const num = (v: unknown): number | null =>
  typeof v === 'number' ? v : v === null ? null : Number(v);
const str = (v: unknown): string | null => (typeof v === 'string' ? v : null);

function connectionOf(r: Record<string, unknown>): Connection {
  const done = num(r.progress_done);
  const total = num(r.progress_total);
  return {
    personId: String(r.person_id),
    sealedRefresh: String(r.sealed_refresh),
    googleAccount: String(r.google_account),
    connectedAt: num(r.connected_at) ?? 0,
    status: (str(r.status) ?? 'ok') as DriveStatus,
    rootId: str(r.root_id),
    rootName: str(r.root_name),
    pageToken: str(r.page_token),
    pendingSealed: str(r.pending_sealed),
    pendingAccount: str(r.pending_account),
    pendingUntil: num(r.pending_until),
    channelId: str(r.channel_id),
    channelResource: str(r.channel_resource),
    channelExpiresAt: num(r.channel_expires_at),
    channelFailedAt: num(r.channel_failed_at),
    backoff: { level: num(r.backoff_level) ?? 0, lastErrorAt: num(r.backoff_error_at) },
    lastPassAt: num(r.last_pass_at),
    lastSyncedAt: num(r.last_synced_at),
    syncing: Boolean(num(r.syncing)),
    progress: done !== null && total !== null ? { done, total } : null,
    flushNext: Boolean(num(r.flush_next)),
    pickerWindowStart: num(r.picker_window_start),
    pickerCount: num(r.picker_count) ?? 0,
  };
}

function rowOf(r: Record<string, unknown>): StoredRow {
  const app = str(r.app);
  return {
    kind: r.kind === 'folder' ? 'folder' : 'item',
    id: String(r.id),
    app: isAppName(app) ? app : null,
    driveFileId: String(r.drive_file_id),
    name: String(r.name),
    parentId: str(r.parent_id),
    trashed: Boolean(num(r.trashed)),
    md5: str(r.md5),
    headRevisionId: str(r.head_revision_id),
    localName: String(r.local_name),
    mirroredUpdatedAt: num(r.mirrored_updated_at),
    contentWrittenAt: num(r.content_written_at),
    notice: r.notice === 'unseen_folder' ? 'unseen_folder' : null,
    noticeParentId: str(r.notice_parent_id),
    seenUpdatedAt: num(r.seen_updated_at),
  };
}

export class MirrorStore {
  private readonly sql: Sql;
  private ready = false;

  constructor(sql: Sql) {
    this.sql = sql;
  }

  private writable(): Sql {
    if (!this.ready) {
      for (const statement of SCHEMA.split(';')
        .map((s) => s.trim())
        .filter(Boolean))
        this.sql.exec(statement);
      this.ready = true;
    }
    return this.sql;
  }

  private readable(): Sql | null {
    if (this.ready) return this.sql;
    const found = this.sql
      .exec("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'drive_connection'")
      .toArray();
    return found.length > 0 ? this.writable() : null;
  }

  connection(): Connection | null {
    const sql = this.readable();
    const row = sql?.exec('SELECT * FROM drive_connection WHERE id = 1').toArray()[0];
    return row ? connectionOf(row) : null;
  }

  createConnection(input: {
    personId: string;
    sealedRefresh: string;
    googleAccount: string;
    connectedAt: number;
  }): void {
    this.writable().exec(
      `INSERT INTO drive_connection (id, person_id, sealed_refresh, google_account, connected_at, status)
       VALUES (1, ?, ?, ?, ?, 'ok')`,
      input.personId,
      input.sealedRefresh,
      input.googleAccount,
      input.connectedAt,
    );
  }

  updateConnection(patch: Partial<Connection>): void {
    const sets: string[] = [];
    const values: Value[] = [];
    for (const [field, value] of Object.entries(patch) as [keyof Connection, unknown][]) {
      if (field === 'backoff') {
        const b = value as Backoff;
        sets.push('backoff_level = ?', 'backoff_error_at = ?');
        values.push(b.level, b.lastErrorAt);
      } else if (field === 'progress') {
        const p = value as Connection['progress'];
        sets.push('progress_done = ?', 'progress_total = ?');
        values.push(p?.done ?? null, p?.total ?? null);
      } else {
        const column = (COLUMNS as Partial<Record<keyof Connection, string>>)[field];
        if (!column) continue;
        sets.push(`${column} = ?`);
        values.push(typeof value === 'boolean' ? Number(value) : (value as Value));
      }
    }
    if (sets.length === 0) return;
    const sql = this.readable();
    sql?.exec(`UPDATE drive_connection SET ${sets.join(', ')} WHERE id = 1`, ...values);
  }

  rows(): StoredRow[] {
    const sql = this.readable();
    return sql ? sql.exec('SELECT * FROM drive_items').toArray().map(rowOf) : [];
  }

  row(kind: DriveRowKind, id: string): StoredRow | null {
    const found = this.readable()
      ?.exec('SELECT * FROM drive_items WHERE kind = ? AND id = ?', kind, id)
      .toArray()[0];
    return found ? rowOf(found) : null;
  }

  /** Record a row. A row still naming the same Drive file (a file re-created, a folder adopted) gives way. */
  putRow(row: DriveRow): void {
    const sql = this.writable();
    sql.exec(
      'DELETE FROM drive_items WHERE drive_file_id = ? AND NOT (kind = ? AND id = ?)',
      row.driveFileId,
      row.kind,
      row.id,
    );
    sql.exec(
      `INSERT INTO drive_items (kind, id, app, drive_file_id, name, parent_id, trashed, md5, head_revision_id,
         local_name, mirrored_updated_at, content_written_at, notice, notice_parent_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (kind, id) DO UPDATE SET app = excluded.app, drive_file_id = excluded.drive_file_id,
         name = excluded.name, parent_id = excluded.parent_id, trashed = excluded.trashed, md5 = excluded.md5,
         head_revision_id = excluded.head_revision_id, local_name = excluded.local_name,
         mirrored_updated_at = excluded.mirrored_updated_at, content_written_at = excluded.content_written_at,
         notice = excluded.notice, notice_parent_id = excluded.notice_parent_id`,
      row.kind,
      row.id,
      row.app,
      row.driveFileId,
      row.name,
      row.parentId,
      Number(row.trashed),
      row.md5,
      row.headRevisionId,
      row.localName,
      row.mirroredUpdatedAt,
      row.contentWrittenAt,
      row.notice,
      row.noticeParentId,
    );
  }

  deleteRow(kind: DriveRowKind, id: string): void {
    this.readable()?.exec('DELETE FROM drive_items WHERE kind = ? AND id = ?', kind, id);
  }

  /** Each live item's updatedAt as this pass read it, for the marks; only rows whose value moved are written. */
  noteSeen(items: Iterable<{ id: string; updatedAt: number }>, rows: Map<string, StoredRow>): void {
    const sql = this.readable();
    if (!sql) return;
    for (const item of items) {
      const row = rows.get(item.id);
      if (!row || row.seenUpdatedAt === item.updatedAt) continue;
      sql.exec(
        "UPDATE drive_items SET seen_updated_at = ? WHERE kind = 'item' AND id = ?",
        item.updatedAt,
        item.id,
      );
    }
  }

  failures(): Set<string> {
    const sql = this.readable();
    return new Set(
      sql
        ? sql
            .exec('SELECT id FROM drive_failures')
            .toArray()
            .map((r) => String(r.id))
        : [],
    );
  }

  setFailed(id: string, failed: boolean, now: number): void {
    if (failed) {
      this.writable().exec(
        'INSERT INTO drive_failures (id, at) VALUES (?, ?) ON CONFLICT (id) DO UPDATE SET at = excluded.at',
        id,
        now,
      );
    } else {
      this.readable()?.exec('DELETE FROM drive_failures WHERE id = ?', id);
    }
  }

  /** Forget every row (a switch to another Google account): the connection stays. */
  clearRows(): void {
    const sql = this.readable();
    sql?.exec('DELETE FROM drive_items');
    sql?.exec('DELETE FROM drive_failures');
  }

  /** After the object's storage was deleted outright: the schema is made again on the next write. */
  forgetSchema(): void {
    this.ready = false;
  }

  /** Forget everything: disconnect and account deletion. */
  clearAll(): void {
    const sql = this.readable();
    if (!sql) return;
    sql.exec('DELETE FROM drive_items');
    sql.exec('DELETE FROM drive_failures');
    sql.exec('DELETE FROM drive_connection');
  }
}
