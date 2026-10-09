// document_opens — Explorer Home's last opens (migrations 0063 and 0065,
// docs/specs/013-workspace/explorer-home.md "Opens"; blueprint "Data and persistence"). One row per
// person per document they have opened: the last open, which Jump back in's Recent reads, and its
// UTC day, which gates the day's one `document_opened` event (the open-day record Most used counts).

import type { Runtime } from '../types';

export type DocumentOpen = { lastOpenedAt: number; lastOpenDay: string };

export async function getDocumentOpen(
  env: Runtime,
  ownerId: string,
  documentId: string,
): Promise<DocumentOpen | null> {
  const row = await env.db
    .prepare(
      `SELECT last_opened_at, last_open_day FROM document_opens
      WHERE owner_id = ?1 AND document_id = ?2`,
    )
    .bind(ownerId, documentId)
    .first<{ last_opened_at: number; last_open_day: string }>();
  return row ? { lastOpenedAt: row.last_opened_at, lastOpenDay: row.last_open_day } : null;
}

// Count one open day. The update only lands when the stored day is EARLIER than this one, so of
// two requests racing to record the same day exactly one writes. Returns whether this call did.
export async function recordOpenDay(
  env: Runtime,
  ownerId: string,
  documentId: string,
  open: { at: number; day: string },
): Promise<boolean> {
  const res = await env.db
    .prepare(
      `INSERT INTO document_opens (owner_id, document_id, last_opened_at, last_open_day)
     VALUES (?1, ?2, ?3, ?4)
     ON CONFLICT (owner_id, document_id) DO UPDATE SET
       last_opened_at = excluded.last_opened_at,
       last_open_day = excluded.last_open_day
     WHERE document_opens.last_open_day < excluded.last_open_day`,
    )
    .bind(ownerId, documentId, open.at, open.day)
    .run();
  return (res.meta?.changes ?? 0) > 0;
}

// A later open on a day already counted: only the last open moves, and never backwards.
export async function touchLastOpen(
  env: Runtime,
  ownerId: string,
  documentId: string,
  at: number,
): Promise<void> {
  await env.db
    .prepare(
      `UPDATE document_opens SET last_opened_at = ?3
      WHERE owner_id = ?1 AND document_id = ?2 AND last_opened_at < ?3`,
    )
    .bind(ownerId, documentId, at)
    .run();
}

// Account deletion: the person's opens go. Other people's opens of the account's documents go
// with the documents (the foreign key cascades).
export async function deleteDocumentOpensForOwner(env: Runtime, ownerId: string): Promise<void> {
  await env.db.prepare('DELETE FROM document_opens WHERE owner_id = ?1').bind(ownerId).run();
}

// Sign-up migration. Every row the account does not already hold moves as it is; a document
// opened under both identities keeps the later open. (Its open days are events, which move with
// the rest of the Timeline, so the use days are the days of either.)
export async function migrateDocumentOpens(
  env: Runtime,
  fromOwnerId: string,
  toOwnerId: string,
): Promise<{ moved: number; merged: number }> {
  const moved = await env.db
    .prepare('UPDATE OR IGNORE document_opens SET owner_id = ?1 WHERE owner_id = ?2')
    .bind(toOwnerId, fromOwnerId)
    .run();
  // What is left of the guest's rows: documents the account had opened too.
  const both = await env.db
    .prepare(
      `SELECT COUNT(*) AS n FROM document_opens g
      WHERE g.owner_id = ?2
        AND EXISTS (SELECT 1 FROM document_opens a WHERE a.owner_id = ?1 AND a.document_id = g.document_id)`,
    )
    .bind(toOwnerId, fromOwnerId)
    .first<{ n: number }>();
  await env.db.batch([
    env.db
      .prepare(
        `UPDATE document_opens AS a
          SET last_opened_at = g.last_opened_at, last_open_day = g.last_open_day
         FROM document_opens AS g
        WHERE a.owner_id = ?1 AND g.owner_id = ?2 AND g.document_id = a.document_id
          AND g.last_opened_at > a.last_opened_at`,
      )
      .bind(toOwnerId, fromOwnerId),
    env.db.prepare('DELETE FROM document_opens WHERE owner_id = ?1').bind(fromOwnerId),
  ]);
  return { moved: moved.meta?.changes ?? 0, merged: both?.n ?? 0 };
}

// Daily retention sweep: an open older than the Timeline's year is forgotten. Signature matches
// the other sweeps so it slots into `scheduleSweep`.
export async function deleteOldDocumentOpens(env: Runtime, cutoff: number): Promise<number> {
  const res = await env.db
    .prepare('DELETE FROM document_opens WHERE last_opened_at < ?1')
    .bind(cutoff)
    .run();
  return res.meta?.changes ?? 0;
}
