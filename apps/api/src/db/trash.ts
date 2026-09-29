// The Trash (docs/specs/013-workspace/trash.md): a deleted diagram keeps its
// row with `trashed_at` stamped (migration 0051), stays restorable for 30
// days, then the daily cron purges it through diagramRemovalStatements.
//
// trashDiagram / restoreDiagram / purgeDiagrams are plain calls with no HTTP
// concerns, so a later mirror (Drive's bin) can drive them directly.

import { TRASH_RETENTION_MS, trashPurgeDueAt, type TrashedDocument } from '@livediagram/api-schema';
import type { Env } from '../types';
import { documentRemovalStatements } from './document-removal';
import { thumbnailKey } from './documents';
import { documentsTimelineSweepStatement } from './timeline';

// Ids per purge batch: one json_each list bound into three statements, so the
// statement count is flat however many diagrams go. 100 ids is ~4 KB bound.
export const TRASH_PURGE_BATCH = 100;
// Batches per cron run: 20 x 100 = 2,000 purges a day, at ~4 D1 queries and
// one R2 call per batch, far inside the 1,000-query invocation limit. A larger
// backlog drains over the following days, oldest first.
export const TRASH_PURGE_MAX_BATCHES = 20;

export type TrashedDocumentMeta = {
  id: string;
  ownerId: string;
  teamId: string | null;
  name: string;
  trashedAt: number;
};

// Move a live diagram to the Trash. False when there is no live diagram with
// this id (missing, or already trashed: the first deletion time stands).
export async function trashDocument(env: Env, id: string, now: number): Promise<boolean> {
  const res = await env.DB.prepare(
    'UPDATE documents SET trashed_at = ? WHERE id = ? AND trashed_at IS NULL',
  )
    .bind(now, id)
    .run();
  return res.meta.changes === 1;
}

// Bring a trashed diagram back. It returns to its folder when that folder
// still exists in the diagram's scope (its owner's personal tree, or its
// team's), else to Unsorted. False when it isn't in the Trash.
export async function restoreDocument(env: Env, id: string): Promise<boolean> {
  const res = await env.DB.prepare(
    `UPDATE documents
        SET trashed_at = NULL,
            folder_id = CASE
              WHEN EXISTS (SELECT 1 FROM folders f
                            WHERE f.id = documents.folder_id
                              AND ((documents.team_id IS NULL AND f.team_id IS NULL
                                    AND f.owner_id = documents.owner_id)
                                   OR f.team_id = documents.team_id))
              THEN folder_id ELSE NULL END
      WHERE id = ? AND trashed_at IS NOT NULL`,
  )
    .bind(id)
    .run();
  return res.meta.changes === 1;
}

// The gate-only projection of a TRASHED diagram, for the doors that owe an
// authorised caller the deleted state rather than a not-found. Null for a
// live or missing id.
export async function getTrashedDocumentMeta(
  env: Env,
  id: string,
): Promise<TrashedDocumentMeta | null> {
  const row = await env.DB.prepare(
    `SELECT id, owner_id, team_id, name, trashed_at FROM documents
      WHERE id = ? AND trashed_at IS NOT NULL`,
  )
    .bind(id)
    .first<{
      id: string;
      owner_id: string;
      team_id: string | null;
      name: string;
      trashed_at: number;
    }>();
  return row
    ? {
        id: row.id,
        ownerId: row.owner_id,
        teamId: row.team_id ?? null,
        name: row.name,
        trashedAt: row.trashed_at,
      }
    : null;
}

// Which of `ids` are in the Trash.
export async function trashedIdsIn(env: Env, ids: string[]): Promise<Set<string>> {
  if (ids.length === 0) return new Set();
  const res = await env.DB.prepare(
    `SELECT id FROM documents
      WHERE id IN (SELECT value FROM json_each(?)) AND trashed_at IS NOT NULL`,
  )
    .bind(JSON.stringify(ids))
    .all<{ id: string }>();
  return new Set((res.results ?? []).map((r) => r.id));
}

// Everything the caller may restore: their personal Trash (owner, not in a
// team), plus the Trash of every team they have joined. Team membership is
// read against the server-verified account id only, never the guest header
// (docs/specs/013-workspace/team-shared-documents.md trust boundary). Newest first.
export async function listTrash(
  env: Env,
  caller: { owner: string; verifiedUserId: string | null },
): Promise<TrashedDocument[]> {
  const res = await env.DB.prepare(
    `SELECT d.id, d.name, d.team_id, t.name AS team_name, d.trashed_at
       FROM documents d
       LEFT JOIN teams t ON t.id = d.team_id
      WHERE d.trashed_at IS NOT NULL
        AND ((d.owner_id = ?1 AND d.team_id IS NULL)
             OR (?2 IS NOT NULL AND d.team_id IN
                  (SELECT team_id FROM team_members WHERE user_id = ?2 AND status = 'joined')))
      ORDER BY d.trashed_at DESC, d.id ASC`,
  )
    .bind(caller.owner, caller.verifiedUserId)
    .all<{
      id: string;
      name: string;
      team_id: string | null;
      team_name: string | null;
      trashed_at: number;
    }>();
  return (res.results ?? []).map((r) => ({
    id: r.id,
    name: r.name,
    teamId: r.team_id ?? null,
    teamName: r.team_id ? (r.team_name ?? null) : null,
    trashedAt: r.trashed_at,
    purgeAt: trashPurgeDueAt(r.trashed_at),
  }));
}

// The ids in one Trash: the caller's personal one, or one team's.
export async function trashIdsFor(
  env: Env,
  scope: { owner: string } | { teamId: string },
): Promise<string[]> {
  const stmt =
    'teamId' in scope
      ? env.DB.prepare(
          'SELECT id FROM documents WHERE team_id = ? AND trashed_at IS NOT NULL',
        ).bind(scope.teamId)
      : env.DB.prepare(
          'SELECT id FROM documents WHERE owner_id = ? AND team_id IS NULL AND trashed_at IS NOT NULL',
        ).bind(scope.owner);
  const res = await stmt.all<{ id: string }>();
  return (res.results ?? []).map((r) => r.id);
}

// Delete trashed diagrams for good: the diagram rows, the tabs no other
// diagram holds (diagramRemovalStatements), their Timeline events and their
// cached snapshots. Only ever trashed ids: a live id in `ids` is skipped, so
// no caller can purge past the Trash. Returns how many were purged.
export async function purgeDocuments(env: Env, ids: string[]): Promise<number> {
  let purged = 0;
  for (let i = 0; i < ids.length; i += TRASH_PURGE_BATCH) {
    const doomed = [...(await trashedIdsIn(env, ids.slice(i, i + TRASH_PURGE_BATCH)))];
    if (doomed.length === 0) continue;
    const results = await env.DB.batch([
      documentsTimelineSweepStatement(env, doomed),
      ...documentRemovalStatements(env, { ids: doomed }),
    ]);
    purged += results[results.length - 1]?.meta.changes ?? 0;
    // Best effort, like deleteDiagram's: a snapshot left behind is an orphan
    // R2 object, never a reason to fail the purge that already landed.
    if (env.IMAGES) {
      await env.IMAGES.delete(doomed.map(thumbnailKey)).catch((err: unknown) => {
        console.warn('[trash] snapshot delete failed', doomed.length, err);
      });
    }
  }
  return purged;
}

// The cron's sweep: purge every diagram trashed at least TRASH_RETENTION_MS
// ago, oldest first, at most maxBatches x batch per run.
export async function purgeExpiredTrash(
  env: Env,
  now: number,
  opts: { batch?: number; maxBatches?: number } = {},
): Promise<number> {
  const batch = opts.batch ?? TRASH_PURGE_BATCH;
  const maxBatches = opts.maxBatches ?? TRASH_PURGE_MAX_BATCHES;
  const cutoff = now - TRASH_RETENTION_MS;
  let purged = 0;
  for (let round = 0; round < maxBatches; round++) {
    const res = await env.DB.prepare(
      `SELECT id FROM documents
        WHERE trashed_at IS NOT NULL AND trashed_at <= ?
        ORDER BY trashed_at ASC, id ASC LIMIT ?`,
    )
      .bind(cutoff, batch)
      .all<{ id: string }>();
    const ids = (res.results ?? []).map((r) => r.id);
    if (ids.length === 0) break;
    purged += await purgeDocuments(env, ids);
    if (ids.length < batch) break;
  }
  return purged;
}
