// The Inbox's read state (liveworkspace/docs/specs/004-index/inbox-reading.md "Read and unread", blueprint inbox.md
// "Read state"): each person's read rows by key, at the row's time when it was read (0: marked unread), and their last
// Mark All Read. Kept here so a row read in one app reads as read in every other, and on every device.
//
//   PUT /inbox/read   { read?: [{ key, at }], unread?: [key], all?: true }   → 204, an account's alone
//
// `GET /inbox` answers `read` (inboxReadOf) from two statements in its own batch (readStateStatements).

import {
  INBOX_READ_BATCH_MAX,
  INBOX_READS_MAX,
  INBOX_ROW_KEY_MAX,
  type InboxReadState,
} from '@liveworkspace/index-client';
import type { Person } from './auth';
import type { PersonContext } from './context';
import { badRequest, forbidden, noContent, notFound, readObject } from './http';

/** Whether the person keeps read state here: an account in person, never a guest, an app, the Drive mirror or an
 *  export acting for them. */
export const keepsReadState = (person: Person): boolean =>
  person.kind === 'account' && !person.app && !person.drive && !person.export;

const isKey = (v: unknown): v is string =>
  typeof v === 'string' && v.length > 0 && v.length <= INBOX_ROW_KEY_MAX;
const isTime = (v: unknown): v is number =>
  typeof v === 'number' && Number.isSafeInteger(v) && v >= 0;

type ReadBody = { read: { key: string; at: number }[]; unread: string[]; all: boolean };

/** A change's body, or null for a malformed one (a bad key or time, too many, nothing asked). */
export function parseReadChange(value: Record<string, unknown> | null): ReadBody | null {
  if (!value) return null;
  const read = value.read ?? [];
  const unread = value.unread ?? [];
  if (!Array.isArray(read) || !Array.isArray(unread)) return null;
  if (read.length > INBOX_READ_BATCH_MAX || unread.length > INBOX_READ_BATCH_MAX) return null;
  if (value.all !== undefined && value.all !== true) return null;
  const rows: { key: string; at: number }[] = [];
  for (const r of read as unknown[]) {
    const row = r as { key?: unknown; at?: unknown } | null;
    if (!row || typeof row !== 'object' || !isKey(row.key) || !isTime(row.at)) return null;
    rows.push({ key: row.key, at: row.at });
  }
  if (!unread.every(isKey)) return null;
  const all = value.all === true;
  if (!all && rows.length === 0 && unread.length === 0) return null;
  return { read: rows, unread: unread as string[], all };
}

export async function handleInboxRead(ctx: PersonContext): Promise<Response> {
  const { request, env, person } = ctx;
  if (request.method !== 'PUT') return notFound();
  if (!keepsReadState(person)) return forbidden();
  const change = parseReadChange(await readObject(request));
  if (!change) return badRequest('invalid_read');
  const db = env.INDEX_DB;
  const now = Date.now();
  const statements: D1PreparedStatement[] = [];
  if (change.all) {
    statements.push(
      db.prepare('DELETE FROM inbox_reads WHERE person_id = ?').bind(person.id),
      db
        .prepare(
          `INSERT INTO inbox_read_marks (person_id, before) VALUES (?1, ?2)
           ON CONFLICT (person_id) DO UPDATE SET before = MAX(before, excluded.before)`,
        )
        .bind(person.id, now),
    );
  }
  if (change.read.length > 0) {
    // A row read at a time is never moved back by an older one; a held unread (0) gives way.
    statements.push(
      db
        .prepare(
          `INSERT INTO inbox_reads (person_id, row_key, at, read_at)
           SELECT ?1, json_extract(value, '$.key'), json_extract(value, '$.at'), ?2 FROM json_each(?3) WHERE true
           ON CONFLICT (person_id, row_key) DO UPDATE SET at = MAX(at, excluded.at), read_at = excluded.read_at`,
        )
        .bind(person.id, now, JSON.stringify(change.read)),
    );
  }
  if (change.unread.length > 0) {
    statements.push(
      db
        .prepare(
          `INSERT INTO inbox_reads (person_id, row_key, at, read_at)
           SELECT ?1, value, 0, ?2 FROM json_each(?3) WHERE true
           ON CONFLICT (person_id, row_key) DO UPDATE SET at = 0, read_at = excluded.read_at`,
        )
        .bind(person.id, now, JSON.stringify(change.unread)),
    );
  }
  // The newest INBOX_READS_MAX entries are kept, through inbox_reads_person.
  statements.push(
    db
      .prepare(
        `DELETE FROM inbox_reads WHERE person_id = ?1 AND row_key NOT IN (
           SELECT row_key FROM inbox_reads WHERE person_id = ?1 ORDER BY read_at DESC LIMIT ?2)`,
      )
      .bind(person.id, INBOX_READS_MAX),
  );
  await db.batch(statements);
  return noContent();
}

/** The two reads `GET /inbox` adds to its batch for a person who keeps read state: their mark, and their newest
 *  entries. */
export function readStateStatements(db: D1Database, personId: string): D1PreparedStatement[] {
  return [
    db.prepare('SELECT before FROM inbox_read_marks WHERE person_id = ?').bind(personId),
    db
      .prepare(
        `SELECT row_key, at FROM inbox_reads WHERE person_id = ?
         ORDER BY read_at DESC LIMIT ?`,
      )
      .bind(personId, INBOX_READS_MAX),
  ];
}

/** The answer's `read`: the mark, and the entries of the rows listed (`keys`) alone, so it stays the list's size. */
export function inboxReadOf(
  mark: readonly Record<string, unknown>[],
  entries: readonly Record<string, unknown>[],
  keys: readonly string[],
): InboxReadState {
  const listed = new Set(keys);
  const at: Record<string, number> = {};
  for (const e of entries) {
    const key = e.row_key as string;
    if (listed.has(key)) at[key] = e.at as number;
  }
  const before = mark[0]?.before;
  return { before: typeof before === 'number' ? before : 0, at };
}
