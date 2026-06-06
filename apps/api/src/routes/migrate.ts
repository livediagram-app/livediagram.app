// /api/migrate — guest -> authed ownership migration.

import { migrateOwnerId } from '../db';
import { badRequest, json, missingAuth, notFound } from '../responses';
import type { RouteContext } from './context';

// Guest → authed ownership migration. Called from the live
// app's sign-up flow once Clerk reports a session; moves
// every `diagrams.owner_id` and `folders.owner_id` row from
// the caller's localStorage participant id (`guestOwnerId`)
// to their verified Clerk userId. Clerk-only — there is no
// X-Owner-Id fallback here, because the entire purpose of
// this endpoint is to lock data behind a Clerk account.
// Idempotent: a second call with the same `guestOwnerId`
// simply moves zero rows.
export async function handleMigrate(ctx: RouteContext): Promise<Response> {
  const { request, env, segments, clerkUserId } = ctx;
  if (!(segments[1] === 'migrate' && segments.length === 2)) return notFound();
  if (request.method === 'POST') {
    if (!clerkUserId) return missingAuth();
    const body = (await request.json().catch(() => null)) as {
      guestOwnerId?: string;
    } | null;
    const fromOwnerId = body?.guestOwnerId?.trim();
    if (!fromOwnerId) return badRequest('guestOwnerId is required');
    if (fromOwnerId === clerkUserId) {
      // Nothing to do — the guest id already matches the
      // Clerk userId (e.g. retry after a successful run).
      return json({ migrated: { diagrams: 0, folders: 0, shared: 0, images: 0 } });
    }
    const migrated = await migrateOwnerId(env, fromOwnerId, clerkUserId);
    return json({ migrated });
  }
  return notFound();
}
