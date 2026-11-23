// The snapshot store (liveworkspace/docs/specs/014-snapshots/blueprints/snapshots.md SN3 to SN9): an item's snapshots in
// its own Durable Object SQLite, over the D1 surface every app's room hands its handlers (`env.<ITEM>_DB`). A body is
// cut into chunks under the 2 MB row limit, measured before anything is written, and only the latest SNAPSHOTS_KEPT
// stay. The item's generation lives beside them.

import { SNAPSHOTS_KEPT, SNAPSHOT_CHUNK_CHARS, SNAPSHOT_MAX_BYTES } from './limits';
import type { SnapshotAuthor, SnapshotKind, SnapshotSummary } from './wire';

/** The slice of a D1 prepared statement the store uses. */
export interface SnapshotStatement {
  bind(...values: unknown[]): SnapshotStatement;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<{ results?: T[] }>;
  run(): Promise<unknown>;
}

/** The slice of D1Database the store uses: the item's own SQLite as its room hands it out. */
export interface SnapshotDb {
  prepare(query: string): SnapshotStatement;
  batch(statements: SnapshotStatement[]): Promise<unknown[]>;
  exec(query: string): Promise<unknown>;
}

/** SN3, SN31: the tables, every statement IF NOT EXISTS; an app's schema step may run it before its own trigger
 *  names them. */
export const SNAPSHOT_SCHEMA = `
CREATE TABLE IF NOT EXISTS snapshots (
  id           TEXT    PRIMARY KEY,
  item_id      TEXT    NOT NULL,
  name         TEXT    NULL,
  kind         TEXT    NOT NULL CHECK (kind IN ('manual', 'before-revert')),
  author_id    TEXT    NULL,
  author_name  TEXT    NULL,
  author_color TEXT    NULL,
  bytes        INTEGER NOT NULL,
  chunks       INTEGER NOT NULL,
  created_at   INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS snapshots_by_item ON snapshots (item_id, created_at);
CREATE TABLE IF NOT EXISTS snapshot_chunks (
  snapshot_id TEXT    NOT NULL REFERENCES snapshots (id) ON DELETE CASCADE,
  seq         INTEGER NOT NULL,
  data        TEXT    NOT NULL,
  PRIMARY KEY (snapshot_id, seq)
);
CREATE TABLE IF NOT EXISTS snapshot_state (
  item_id    TEXT    PRIMARY KEY,
  generation INTEGER NOT NULL
);
`;

// SN3: the schema once per database handle (a room keeps one for its life; a test makes one per case).
const ready = new WeakSet<SnapshotDb>();
async function ensureSchema(db: SnapshotDb): Promise<void> {
  if (ready.has(db)) return;
  await db.exec(SNAPSHOT_SCHEMA);
  ready.add(db);
}

/** A snapshot id: `s_` and 16 lower-case hex characters. */
export function snapshotId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return `s_${[...bytes].map((b) => b.toString(16).padStart(2, '0')).join('')}`;
}

/** The text's UTF-8 length, without encoding it. */
export function utf8Bytes(text: string): number {
  let bytes = 0;
  for (let i = 0; i < text.length; i += 1) {
    const unit = text.charCodeAt(i);
    if (unit < 0x80) bytes += 1;
    else if (unit < 0x800) bytes += 2;
    else if (unit >= 0xd800 && unit <= 0xdbff && i + 1 < text.length) {
      const next = text.charCodeAt(i + 1);
      if (next >= 0xdc00 && next <= 0xdfff) {
        bytes += 4;
        i += 1;
      } else bytes += 3;
    } else bytes += 3;
  }
  return bytes;
}

/** SN4: the text in pieces of at most `size` UTF-16 units, never cut between a surrogate pair. */
export function chunkText(text: string, size = SNAPSHOT_CHUNK_CHARS): string[] {
  if (text.length === 0) return [''];
  const chunks: string[] = [];
  let at = 0;
  while (at < text.length) {
    let end = Math.min(at + size, text.length);
    const last = text.charCodeAt(end - 1);
    if (end < text.length && last >= 0xd800 && last <= 0xdbff) end -= 1;
    chunks.push(text.slice(at, end));
    at = end;
  }
  return chunks;
}

type SnapshotRow = {
  id: string;
  name: string | null;
  kind: SnapshotKind;
  author_id: string | null;
  author_name: string | null;
  author_color: string | null;
  bytes: number;
  chunks: number;
  created_at: number;
};

const COLUMNS = 'id, name, kind, author_id, author_name, author_color, bytes, chunks, created_at';

function summaryOf(row: SnapshotRow): SnapshotSummary {
  return {
    id: row.id,
    name: row.name,
    kind: row.kind,
    author:
      row.author_name !== null
        ? { id: row.author_id ?? '', name: row.author_name, color: row.author_color ?? '' }
        : null,
    createdAt: row.created_at,
    bytes: row.bytes,
  };
}

/** SN7: the item's snapshots, newest first, without bodies. */
export async function listSnapshots(db: SnapshotDb, itemId: string): Promise<SnapshotSummary[]> {
  await ensureSchema(db);
  const res = await db
    .prepare(
      `SELECT ${COLUMNS} FROM snapshots WHERE item_id = ? ORDER BY created_at DESC, rowid DESC`,
    )
    .bind(itemId)
    .all<SnapshotRow>();
  return (res.results ?? []).map(summaryOf);
}

/** With Pro on, a tier that keeps snapshots for a time: every snapshot of the item taken before `before` goes, with
 *  its chunks (snapshots.md "With Pro on"). Only the item's own: a save point of one part of it is another item id. */
export async function dropSnapshotsBefore(
  db: SnapshotDb,
  itemId: string,
  before: number,
  /** SN35: the snapshots a rule names, which are never dropped for their age either. */
  keptIds: readonly string[] = [],
): Promise<void> {
  await ensureSchema(db);
  await db.batch([
    db
      .prepare(
        'DELETE FROM snapshots WHERE item_id = ? AND created_at < ? AND id NOT IN (SELECT value FROM json_each(?))',
      )
      .bind(itemId, before, JSON.stringify(keptIds)),
    // A database without foreign keys on (a test's) keeps no orphan chunk either.
    db.prepare('DELETE FROM snapshot_chunks WHERE snapshot_id NOT IN (SELECT id FROM snapshots)'),
  ]);
}

/** One snapshot's summary, or null. */
export async function getSnapshot(
  db: SnapshotDb,
  itemId: string,
  id: string,
): Promise<SnapshotSummary | null> {
  await ensureSchema(db);
  const row = await db
    .prepare(`SELECT ${COLUMNS} FROM snapshots WHERE id = ? AND item_id = ?`)
    .bind(id, itemId)
    .first<SnapshotRow>();
  return row ? summaryOf(row) : null;
}

export type TakeInput = {
  itemId: string;
  text: string;
  name: string | null;
  kind: SnapshotKind;
  author: SnapshotAuthor | null;
  now?: number;
  /** SN31: the id, minted by the caller with `snapshotId()`; one is minted when absent. */
  id?: string;
  /** SN31: how many of the item's snapshots stay; `null` keeps every one (the app bounds them). */
  keep?: number | null;
  /** SN35: the snapshots a rule names. Never removed to make room, and not counted toward `keep`. */
  keptIds?: readonly string[];
  /** SN31: statements run in the take's own batch after its chunks, given the snapshot's id. */
  alongside?: (id: string) => SnapshotStatement[];
};

export type TakeResult =
  { ok: true; snapshot: SnapshotSummary } | { ok: false; reason: 'too_large' };

/** SN4, SN5, SN35: the text kept as a snapshot, refused whole when over the cap, the oldest past SNAPSHOTS_KEPT
 *  removed in the same transaction, those in `keptIds` left alone and uncounted. */
export async function takeSnapshot(db: SnapshotDb, input: TakeInput): Promise<TakeResult> {
  const bytes = utf8Bytes(input.text);
  if (bytes > SNAPSHOT_MAX_BYTES) return { ok: false, reason: 'too_large' };
  await ensureSchema(db);
  const id = input.id ?? snapshotId();
  const now = input.now ?? Date.now();
  const keep = input.keep === undefined ? SNAPSHOTS_KEPT : input.keep;
  const chunks = chunkText(input.text);
  const statements: SnapshotStatement[] = [
    db
      .prepare(`INSERT INTO snapshots (${COLUMNS}, item_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(
        id,
        input.name,
        input.kind,
        input.author?.id ?? null,
        input.author?.name ?? null,
        input.author?.color ?? null,
        bytes,
        chunks.length,
        now,
        input.itemId,
      ),
    ...chunks.map((data, seq) =>
      db
        .prepare('INSERT INTO snapshot_chunks (snapshot_id, seq, data) VALUES (?, ?, ?)')
        .bind(id, seq, data),
    ),
    ...(input.alongside?.(id) ?? []),
  ];
  if (keep !== null) {
    // One statement whatever the count of kept ids (a JSON list): the newest `keep` of the rest stay.
    statements.push(
      db
        .prepare(
          `DELETE FROM snapshots WHERE item_id = ?1
             AND id NOT IN (SELECT value FROM json_each(?3))
             AND id NOT IN (
               SELECT id FROM snapshots
                WHERE item_id = ?1 AND id NOT IN (SELECT value FROM json_each(?3))
                ORDER BY created_at DESC, rowid DESC LIMIT ?2)`,
        )
        .bind(input.itemId, keep, JSON.stringify(input.keptIds ?? [])),
      // A database without foreign keys on (a test's) keeps no orphan chunk either.
      db.prepare('DELETE FROM snapshot_chunks WHERE snapshot_id NOT IN (SELECT id FROM snapshots)'),
    );
  }
  await db.batch(statements);
  return {
    ok: true,
    snapshot: {
      id,
      name: input.name,
      kind: input.kind,
      author: input.author,
      createdAt: now,
      bytes,
    },
  };
}

/** SN6: the snapshot's text whole, `null` when its chunks are missing or short, `undefined` for no such snapshot. */
export async function readSnapshotText(
  db: SnapshotDb,
  itemId: string,
  id: string,
): Promise<string | null | undefined> {
  await ensureSchema(db);
  const head = await db
    .prepare('SELECT chunks FROM snapshots WHERE id = ? AND item_id = ?')
    .bind(id, itemId)
    .first<{ chunks: number }>();
  if (!head) return undefined;
  const res = await db
    .prepare('SELECT seq, data FROM snapshot_chunks WHERE snapshot_id = ? ORDER BY seq')
    .bind(id)
    .all<{ seq: number; data: string }>();
  const rows = res.results ?? [];
  if (rows.length !== head.chunks || rows.some((r, i) => r.seq !== i)) return null;
  return rows.map((r) => r.data).join('');
}

/** SN8: false when the item holds no such snapshot. */
export async function deleteSnapshot(db: SnapshotDb, itemId: string, id: string): Promise<boolean> {
  await ensureSchema(db);
  const row = await db
    .prepare('DELETE FROM snapshots WHERE id = ? AND item_id = ? RETURNING id')
    .bind(id, itemId)
    .first<{ id: string }>();
  if (!row) return false;
  await db.prepare('DELETE FROM snapshot_chunks WHERE snapshot_id = ?').bind(id).run();
  return true;
}

/** SN32: the snapshot's name set (null for none); false when the item holds no such snapshot. */
export async function renameSnapshot(
  db: SnapshotDb,
  itemId: string,
  id: string,
  name: string | null,
): Promise<boolean> {
  await ensureSchema(db);
  const row = await db
    .prepare('UPDATE snapshots SET name = ? WHERE id = ? AND item_id = ? RETURNING id')
    .bind(name, id, itemId)
    .first<{ id: string }>();
  return row !== null;
}

/** SN33: the snapshot's text replaced whole, measured and chunked as a take is, in one batch. */
export async function rewriteSnapshotText(
  db: SnapshotDb,
  itemId: string,
  id: string,
  text: string,
): Promise<'ok' | 'too_large' | 'missing'> {
  const bytes = utf8Bytes(text);
  if (bytes > SNAPSHOT_MAX_BYTES) return 'too_large';
  await ensureSchema(db);
  const head = await db
    .prepare('SELECT id FROM snapshots WHERE id = ? AND item_id = ?')
    .bind(id, itemId)
    .first<{ id: string }>();
  if (!head) return 'missing';
  const chunks = chunkText(text);
  await db.batch([
    db.prepare('DELETE FROM snapshot_chunks WHERE snapshot_id = ?').bind(id),
    ...chunks.map((data, seq) =>
      db
        .prepare('INSERT INTO snapshot_chunks (snapshot_id, seq, data) VALUES (?, ?, ?)')
        .bind(id, seq, data),
    ),
    db
      .prepare('UPDATE snapshots SET bytes = ?, chunks = ? WHERE id = ? AND item_id = ?')
      .bind(bytes, chunks.length, id, itemId),
  ]);
  return 'ok';
}

/** SN34: a closed account's name off every snapshot it took in this database, the item's own and every scoped save
 *  point alike: `author_id` and `author_name` become `as` where `author_id` is one of `personIds`. Nothing else
 *  changes, and no table is made where none is. Returns how many rows changed; a second run changes none. */
export async function clearSnapshotAuthors(
  db: SnapshotDb,
  personIds: readonly string[],
  as: { id: string; name: string },
): Promise<number> {
  if (personIds.length === 0) return 0;
  if (!ready.has(db)) {
    const table = await db
      .prepare("SELECT 1 AS found FROM sqlite_master WHERE type = 'table' AND name = 'snapshots'")
      .first<{ found: number }>();
    if (table === null) return 0;
  }
  const res = await db
    .prepare(
      `UPDATE snapshots SET author_id = ?1, author_name = ?2
        WHERE author_id IN (SELECT value FROM json_each(?3)) RETURNING id`,
    )
    .bind(as.id, as.name, JSON.stringify(personIds))
    .all<{ id: string }>();
  return (res.results ?? []).length;
}

// SN9: the generation each database handle has read, per item. An object holds one item and every revert goes through
// advanceGeneration, so the kept value is the stored one.
const generations = new WeakMap<SnapshotDb, Map<string, number>>();

function kept(db: SnapshotDb): Map<string, number> {
  let map = generations.get(db);
  if (!map) {
    map = new Map();
    generations.set(db, map);
  }
  return map;
}

/** The item's generation: 0 until its first revert. Never creates a table. */
export async function readGeneration(db: SnapshotDb, itemId: string): Promise<number> {
  const map = kept(db);
  const known = map.get(itemId);
  if (known !== undefined) return known;
  let generation = 0;
  if (ready.has(db) || (await hasStateTable(db))) {
    const row = await db
      .prepare('SELECT generation FROM snapshot_state WHERE item_id = ?')
      .bind(itemId)
      .first<{ generation: number }>();
    generation = row?.generation ?? 0;
  }
  map.set(itemId, generation);
  return generation;
}

async function hasStateTable(db: SnapshotDb): Promise<boolean> {
  const row = await db
    .prepare(
      "SELECT 1 AS found FROM sqlite_master WHERE type = 'table' AND name = 'snapshot_state'",
    )
    .first<{ found: number }>();
  return row !== null;
}

/** One more revert: the item's generation moved on, stored and kept. */
export async function advanceGeneration(db: SnapshotDb, itemId: string): Promise<number> {
  await ensureSchema(db);
  const row = await db
    .prepare(
      `INSERT INTO snapshot_state (item_id, generation) VALUES (?, 1)
       ON CONFLICT (item_id) DO UPDATE SET generation = generation + 1
       RETURNING generation`,
    )
    .bind(itemId)
    .first<{ generation: number }>();
  const generation = row?.generation ?? 1;
  kept(db).set(itemId, generation);
  return generation;
}
