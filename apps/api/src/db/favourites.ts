// favourites — per-user diagram stars (migration 0040, docs/specs/013-workspace/favourites.md).

import type { Env } from '../types';

// Every diagram id this owner has starred. Ids only: the Explorer already
// holds the personal and team diagram rows it needs to render, so shipping
// full rows here would duplicate that (and would have to re-implement the
// team-membership visibility rules the diagram list already applies).
//
// The FK cascade means a purged diagram's stars go with it; a diagram in the
// Trash keeps its stars for the restore but is left out here
// (docs/specs/013-workspace/trash.md), a primary-key probe per star. So an id
// returned here always pointed at a live diagram at query time.
export async function listFavouriteIds(env: Env, ownerId: string): Promise<string[]> {
  const res = await env.DB.prepare(
    `SELECT f.document_id FROM favourites f
      WHERE f.owner_id = ?1
        AND NOT EXISTS (SELECT 1 FROM documents d WHERE d.id = f.document_id AND d.trashed_at IS NOT NULL)
      ORDER BY f.created_at DESC`,
  )
    .bind(ownerId)
    .all<{ document_id: string }>();
  return (res.results ?? []).map((r) => r.document_id);
}

// Star a diagram. Idempotent on (owner_id, document_id) — re-starring an
// already-starred diagram keeps the ORIGINAL created_at rather than
// bumping it, so "when I starred this" stays truthful.
export async function addFavourite(env: Env, ownerId: string, documentId: string): Promise<void> {
  await env.DB.prepare(
    `INSERT INTO favourites (owner_id, document_id, created_at) VALUES (?1, ?2, ?3)
       ON CONFLICT (owner_id, document_id) DO NOTHING`,
  )
    .bind(ownerId, documentId, Date.now())
    .run();
}

// Un-star. Silent when there was no row: the client's toggle is
// last-write-wins and shouldn't error on a double-click.
export async function removeFavourite(
  env: Env,
  ownerId: string,
  documentId: string,
): Promise<void> {
  await env.DB.prepare('DELETE FROM favourites WHERE owner_id = ?1 AND document_id = ?2')
    .bind(ownerId, documentId)
    .run();
}
