// /api/favourites — per-user diagram stars (spec/95).
//
// GET    /api/favourites            -> { ids: string[] }
// PUT    /api/favourites/:diagramId -> 204, star it
// DELETE /api/favourites/:diagramId -> 204, un-star it
//
// Hybrid identity like the rest of the api: the Clerk userId when signed
// in, X-Owner-Id otherwise, so guests get durable favourites too.
//
// Deliberately NOT gated on "can this owner read that diagram". A star is a
// private bookmark in the starrer's own row — it grants no access, reveals
// nothing about the diagram, and the Favourites view renders from the
// diagram lists the client already has permission to see, so an id for
// something you can no longer open simply doesn't appear. Checking access
// on write would cost a lookup per star to prevent nothing.

import { json, missingAuth, noContent, notFound } from '../responses';
import { addFavourite, listFavouriteIds, removeFavourite } from '../db';
import type { RouteContext } from './context';

export async function handleFavourites(ctx: RouteContext): Promise<Response> {
  const { request, env, segments, resolveOwner } = ctx;
  if (segments[1] !== 'favourites') return notFound();
  const ownerId = resolveOwner();
  if (!ownerId) return missingAuth();

  if (segments.length === 2 && request.method === 'GET') {
    return json({ ids: await listFavouriteIds(env, ownerId) });
  }

  const diagramId = segments[2];
  if (segments.length === 3 && diagramId) {
    if (request.method === 'PUT') {
      await addFavourite(env, ownerId, diagramId);
      return noContent();
    }
    if (request.method === 'DELETE') {
      await removeFavourite(env, ownerId, diagramId);
      return noContent();
    }
  }
  return notFound();
}
