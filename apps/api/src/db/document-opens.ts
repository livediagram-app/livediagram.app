// document_opens — Explorer Home's opens (migration 0063, docs/specs/013-workspace/explorer-home.md
// "Opens"; blueprint "Data and persistence"). One row per person per document they have opened:
// the UTC days they opened it on and the frecency key Jump back in ranks by.

import { mergeFrecencyKeys } from '@livediagram/api-schema';
import type { Env } from '../types';

export type DocumentOpen = {
  openDays: number;
  firstOpenedAt: number;
  lastOpenedAt: number;
  lastOpenDay: string;
  frecencyKey: number;
};

type OpenRow = {
  open_days: number;
  first_opened_at: number;
  last_opened_at: number;
  last_open_day: string;
  frecency_key: number;
};

function fromRow(row: OpenRow): DocumentOpen {
  return {
    openDays: row.open_days,
    firstOpenedAt: row.first_opened_at,
    lastOpenedAt: row.last_opened_at,
    lastOpenDay: row.last_open_day,
    frecencyKey: row.frecency_key,
  };
}

export async function getDocumentOpen(
  env: Env,
  ownerId: string,
  documentId: string,
): Promise<DocumentOpen | null> {
  const row = await env.DB.prepare(
    `SELECT open_days, first_opened_at, last_opened_at, last_open_day, frecency_key
       FROM document_opens WHERE owner_id = ?1 AND document_id = ?2`,
  )
    .bind(ownerId, documentId)
    .first<OpenRow>();
  return row ? fromRow(row) : null;
}

// Count one open day. The update only lands when the stored day is EARLIER than this one, so of
// two requests racing to record the same day exactly one writes. Returns whether this call did.
export async function recordOpenDay(
  env: Env,
  ownerId: string,
  documentId: string,
  open: { at: number; day: string; frecencyKey: number },
): Promise<boolean> {
  const res = await env.DB.prepare(
    `INSERT INTO document_opens
       (owner_id, document_id, open_days, first_opened_at, last_opened_at, last_open_day, frecency_key)
     VALUES (?1, ?2, 1, ?3, ?3, ?4, ?5)
     ON CONFLICT (owner_id, document_id) DO UPDATE SET
       open_days = document_opens.open_days + 1,
       last_opened_at = excluded.last_opened_at,
       last_open_day = excluded.last_open_day,
       frecency_key = excluded.frecency_key
     WHERE document_opens.last_open_day < excluded.last_open_day`,
  )
    .bind(ownerId, documentId, open.at, open.day, open.frecencyKey)
    .run();
  return (res.meta?.changes ?? 0) > 0;
}

// Account deletion: the person's opens go. Other people's opens of the account's documents go
// with the documents (the foreign key cascades).
export async function deleteDocumentOpensForOwner(env: Env, ownerId: string): Promise<void> {
  await env.DB.prepare('DELETE FROM document_opens WHERE owner_id = ?1').bind(ownerId).run();
}

// Sign-up migration. Every row the account does not already hold moves as it is; a document
// opened under both identities keeps both histories, its frecencies added and its days summed.
export async function migrateDocumentOpens(
  env: Env,
  fromOwnerId: string,
  toOwnerId: string,
  now: number,
): Promise<{ moved: number; merged: number }> {
  const moved = await env.DB.prepare(
    'UPDATE OR IGNORE document_opens SET owner_id = ?1 WHERE owner_id = ?2',
  )
    .bind(toOwnerId, fromOwnerId)
    .run();
  const both = await env.DB.prepare(
    `SELECT g.document_id,
            g.open_days AS g_days, g.first_opened_at AS g_first, g.last_opened_at AS g_last,
            g.last_open_day AS g_day, g.frecency_key AS g_key,
            a.open_days AS a_days, a.first_opened_at AS a_first, a.last_opened_at AS a_last,
            a.last_open_day AS a_day, a.frecency_key AS a_key
       FROM document_opens g
       JOIN document_opens a ON a.document_id = g.document_id AND a.owner_id = ?1
      WHERE g.owner_id = ?2`,
  )
    .bind(toOwnerId, fromOwnerId)
    .all<{
      document_id: string;
      g_days: number;
      g_first: number;
      g_last: number;
      g_day: string;
      g_key: number;
      a_days: number;
      a_first: number;
      a_last: number;
      a_day: string;
      a_key: number;
    }>();
  const rows = both.results ?? [];
  const merge = env.DB.prepare(
    `UPDATE document_opens
        SET open_days = ?3, first_opened_at = ?4, last_opened_at = ?5, last_open_day = ?6,
            frecency_key = ?7
      WHERE owner_id = ?1 AND document_id = ?2`,
  );
  await env.DB.batch([
    ...rows.map((r) =>
      merge.bind(
        toOwnerId,
        r.document_id,
        r.g_days + r.a_days,
        Math.min(r.g_first, r.a_first),
        Math.max(r.g_last, r.a_last),
        r.g_day > r.a_day ? r.g_day : r.a_day,
        mergeFrecencyKeys(r.g_key, r.a_key, now),
      ),
    ),
    env.DB.prepare('DELETE FROM document_opens WHERE owner_id = ?1').bind(fromOwnerId),
  ]);
  return { moved: moved.meta?.changes ?? 0, merged: rows.length };
}

// Daily retention sweep: an open older than the Timeline's year is forgotten. Signature matches
// the other sweeps so it slots into `scheduleSweep`.
export async function deleteOldDocumentOpens(env: Env, cutoff: number): Promise<number> {
  const res = await env.DB.prepare('DELETE FROM document_opens WHERE last_opened_at < ?1')
    .bind(cutoff)
    .run();
  return res.meta?.changes ?? 0;
}
