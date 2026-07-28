// favourites — per-user diagram stars (migration 0040, spec/95).

import type { Env } from '../types';

// Every diagram id this owner has starred. Ids only: the Explorer already
// holds the personal and team diagram rows it needs to render, so shipping
// full rows here would duplicate that (and would have to re-implement the
// team-membership visibility rules the diagram list already applies).
//
// No join through `diagrams`, so this stays a single-table read. The FK
// cascade means a deleted diagram's stars go with it, so an id returned
// here always pointed at a live diagram at query time.
export async function listFavouriteIds(env: Env, ownerId: string): Promise<string[]> {
  const res = await env.DB.prepare(
    'SELECT diagram_id FROM favourites WHERE owner_id = ?1 ORDER BY created_at DESC',
  )
    .bind(ownerId)
    .all<{ diagram_id: string }>();
  return (res.results ?? []).map((r) => r.diagram_id);
}

// Star a diagram. Idempotent on (owner_id, diagram_id) — re-starring an
// already-starred diagram keeps the ORIGINAL created_at rather than
// bumping it, so "when I starred this" stays truthful.
export async function addFavourite(env: Env, ownerId: string, diagramId: string): Promise<void> {
  await env.DB.prepare(
    `INSERT INTO favourites (owner_id, diagram_id, created_at) VALUES (?1, ?2, ?3)
       ON CONFLICT (owner_id, diagram_id) DO NOTHING`,
  )
    .bind(ownerId, diagramId, Date.now())
    .run();
}

// Un-star. Silent when there was no row: the client's toggle is
// last-write-wins and shouldn't error on a double-click.
export async function removeFavourite(env: Env, ownerId: string, diagramId: string): Promise<void> {
  await env.DB.prepare('DELETE FROM favourites WHERE owner_id = ?1 AND diagram_id = ?2')
    .bind(ownerId, diagramId)
    .run();
}
