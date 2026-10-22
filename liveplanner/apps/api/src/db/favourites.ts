// favourites — per-user project stars (docs/specs/013-workspace/favourites.md).

import type { Env } from '../types';

// Every project id this owner has starred. Ids only: the Explorer already
// holds the personal and team project rows it needs to render, so shipping
// full rows here would duplicate that (and would have to re-implement the
// team-membership visibility rules the project list already applies).
//
// The FK cascade means a purged project's stars go with it; a project in the
// Trash keeps its stars for the restore but is left out here
// (docs/specs/013-workspace/trash.md), a primary-key probe per star. So an id
// returned here always pointed at a live project at query time.
export async function listFavouriteIds(env: Env, ownerId: string): Promise<string[]> {
  const res = await env.DB.prepare(
    `SELECT f.project_id FROM favourites f
      WHERE f.owner_id = ?1
        AND NOT EXISTS (SELECT 1 FROM projects d WHERE d.id = f.project_id AND d.trashed_at IS NOT NULL)
      ORDER BY f.created_at DESC`,
  )
    .bind(ownerId)
    .all<{ project_id: string }>();
  return (res.results ?? []).map((r) => r.project_id);
}

// Star a project. Idempotent on (owner_id, project_id) — re-starring an
// already-starred project keeps the ORIGINAL created_at rather than
// bumping it, so "when I starred this" stays truthful.
// False when there is no such project: the table's foreign key refuses the row, which answers that without a lookup
// on every star (docs/specs/013-workspace/favourites.md).
export async function addFavourite(
  env: Env,
  ownerId: string,
  projectId: string,
): Promise<boolean> {
  try {
    await env.DB.prepare(
      `INSERT INTO favourites (owner_id, project_id, created_at) VALUES (?1, ?2, ?3)
         ON CONFLICT (owner_id, project_id) DO NOTHING`,
    )
      .bind(ownerId, projectId, Date.now())
      .run();
    return true;
  } catch (err) {
    if (err instanceof Error && /FOREIGN KEY constraint failed/.test(err.message)) return false;
    throw err;
  }
}

// Un-star. Silent when there was no row: the client's toggle is
// last-write-wins and shouldn't error on a double-click.
export async function removeFavourite(
  env: Env,
  ownerId: string,
  projectId: string,
): Promise<void> {
  await env.DB.prepare('DELETE FROM favourites WHERE owner_id = ?1 AND project_id = ?2')
    .bind(ownerId, projectId)
    .run();
}
