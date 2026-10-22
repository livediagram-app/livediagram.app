// /api/favourites — per-user project stars (docs/specs/013-workspace/favourites.md).
//
// GET    /api/favourites            -> { ids: string[] }
// PUT    /api/favourites/:projectId -> 204, star it
// DELETE /api/favourites/:projectId -> 204, un-star it
//
// Hybrid identity like the rest of the api: the account id when signed
// in, X-Owner-Id otherwise, so guests get durable favourites too.
//
// Deliberately NOT gated on "can this owner read that project". A star is a
// private bookmark in the starrer's own row — it grants no access, reveals
// nothing about the project, and the Favourites view renders from the
// project lists the client already has permission to see, so an id for
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

  const projectId = segments[2];
  if (segments.length === 3 && projectId) {
    if (request.method === 'PUT') {
      if (!(await addFavourite(env, ownerId, projectId))) return notFound();
      return noContent();
    }
    if (request.method === 'DELETE') {
      await removeFavourite(env, ownerId, projectId);
      return noContent();
    }
  }
  return notFound();
}
