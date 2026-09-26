// /api/activity — the Explorer's Activity page (docs/specs/013-workspace/activity-page.md).
//
// GET /api/activity -> { actions: ActivityAction[], threads: ActivityThread[] }
//
// Read-only: every row is a link into the editor, where completing,
// reassigning and resolving already exist behind their edit gates. So
// there is no other verb here in v1.
//
// Hybrid identity like the rest of the api (docs/specs/014-identity/auth-and-guest-access.md): the Clerk userId
// when signed in, X-Owner-Id otherwise. Guests get their own page (their
// self-assigned to-dos, threads on their diagrams), and it survives
// sign-up through owner_aliases (docs/specs/013-workspace/activity-page.md §2.2).

import { ACTIVITY_LIST_MAX } from '@livediagram/api-schema';
import { getCollabIndexState, readActivity } from '../db';
import { backfillCollabIndex } from '../collab-index/backfill';
import { json, missingAuth, notFound } from '../responses';
import type { RouteContext } from './context';

export async function handleActivity(ctx: RouteContext): Promise<Response> {
  const { request, env, segments, resolveOwner } = ctx;
  if (segments[1] !== 'activity') return notFound();
  const ownerId = resolveOwner();
  if (!ownerId) return missingAuth();

  if (segments.length === 2 && request.method === 'GET') {
    const result = await readActivity(env, ownerId, { limit: ACTIVITY_LIST_MAX });
    // Seed on first sight, off the response path (docs/specs/013-workspace/activity-page.md §2.3). The
    // reader gets whatever the live saves have indexed so far, and the
    // rest the moment they reopen — better than holding the response
    // while every dormant tab is parsed.
    const state = await getCollabIndexState(env, ownerId);
    if (!state) {
      ctx.waitUntil?.(backfillCollabIndex(env, ownerId).catch(() => {}));
    }
    return json(result);
  }

  return notFound();
}
