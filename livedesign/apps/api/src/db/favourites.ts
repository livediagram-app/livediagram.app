// favourites — per-user design stars (the baseline migration, docs/specs/013-workspace/favourites.md).

import type { Env } from '../types';

// Every design id this owner has starred. Ids only: the Explorer already
// holds the personal and team design rows it needs to render, so shipping
// full rows here would duplicate that (and would have to re-implement the
// team-membership visibility rules the design list already applies).
//
// The FK cascade means a purged design's stars go with it; a design in the
// Trash keeps its stars for the restore but is left out here
// (docs/specs/013-workspace/trash.md), a primary-key probe per star. So an id
// returned here always pointed at a live design at query time.
export async function listFavouriteIds(env: Env, ownerId: string): Promise<string[]> {
  const res = await env.DB.prepare(
    `SELECT f.design_id FROM favourites f
      WHERE f.owner_id = ?1
        AND NOT EXISTS (SELECT 1 FROM designs d WHERE d.id = f.design_id AND d.trashed_at IS NOT NULL)
      ORDER BY f.created_at DESC`,
  )
    .bind(ownerId)
    .all<{ design_id: string }>();
  return (res.results ?? []).map((r) => r.design_id);
}

// Star a design. Idempotent on (owner_id, design_id) — re-starring an
// already-starred design keeps the ORIGINAL created_at rather than
// bumping it, so "when I starred this" stays truthful.
// False when there is no such design: the table's foreign key refuses the row, which answers that without a lookup
// on every star (docs/specs/013-workspace/favourites.md).
export async function addFavourite(
  env: Env,
  ownerId: string,
  designId: string,
): Promise<boolean> {
  try {
    await env.DB.prepare(
      `INSERT INTO favourites (owner_id, design_id, created_at) VALUES (?1, ?2, ?3)
         ON CONFLICT (owner_id, design_id) DO NOTHING`,
    )
      .bind(ownerId, designId, Date.now())
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
  designId: string,
): Promise<void> {
  await env.DB.prepare('DELETE FROM favourites WHERE owner_id = ?1 AND design_id = ?2')
    .bind(ownerId, designId)
    .run();
}
