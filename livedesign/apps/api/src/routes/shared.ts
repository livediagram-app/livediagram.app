// /api/shared — designs a non-owner has accessed via a share link.

import { dropSharedAccess, listSharedWith } from '../db';
import { json, missingAuth, notFound } from '../responses';
import type { RouteContext } from './context';

// List designs a non-owner has previously accessed via a
// share link. Used by the Explorer's "Shared with you"
// accordion. Per-owner; pure-guest path works because
// shared_with rows are keyed off the resolved owner string.
export async function handleShared(ctx: RouteContext): Promise<Response> {
  const { request, env, segments, resolveOwner } = ctx;
  if (segments[1] !== 'shared') return notFound();
  if (segments.length === 2) {
    if (request.method === 'GET') {
      const owner = resolveOwner();
      if (!owner) return missingAuth();
      const shared = await listSharedWith(env, owner);
      return json({ shared });
    }
  }
  // /api/shared/<designId> — dismiss / un-link.
  if (segments.length === 3) {
    const designId = segments[2]!;
    if (request.method === 'DELETE') {
      const owner = resolveOwner();
      if (!owner) return missingAuth();
      await dropSharedAccess(env, owner, designId);
      return json({ ok: true });
    }
  }
  return notFound();
}
