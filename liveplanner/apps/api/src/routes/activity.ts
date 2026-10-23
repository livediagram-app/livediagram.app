// /api/activity — the Explorer's Inbox (docs/specs/013-workspace/inbox.md).
//
// GET /api/activity -> { actions: ActivityAction[], threads: ActivityThread[] }
//
// Read-only: every row is a link into the editor, where completing,
// reassigning and resolving already exist behind their edit gates. So
// there is no other verb here in v1.
//
// Hybrid identity like the rest of the api (docs/specs/014-identity/auth-and-guest-access.md): the account id
// when signed in, X-Owner-Id otherwise. Guests get their own page (their
// self-assigned to-dos, threads on their projects), and it survives
// sign-up through owner_aliases (docs/specs/013-workspace/inbox.md §2.2).

import { ACTIVITY_LIST_MAX } from '@liveplanner/api-schema';
import { readActivity } from '../db';
import { json, missingAuth, notFound } from '../responses';
import type { RouteContext } from './context';

export async function handleActivity(ctx: RouteContext): Promise<Response> {
  const { request, env, segments, resolveOwner } = ctx;
  if (segments[1] !== 'activity') return notFound();
  const ownerId = resolveOwner();
  if (!ownerId) return missingAuth();

  if (segments.length === 2 && request.method === 'GET') {
    const result = await readActivity(env, ownerId, { limit: ACTIVITY_LIST_MAX });
    return json(result);
  }

  return notFound();
}
