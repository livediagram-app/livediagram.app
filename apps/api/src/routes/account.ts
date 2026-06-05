// /api/account — account self-deletion.

import { deleteAccount } from '../db';
import { json, missingAuth, notFound } from '../responses';
import type { RouteContext } from './context';

// Account self-deletion. Clerk-only — no X-Owner-Id fallback,
// because the entire purpose is to wipe data bound to a
// verified Clerk identity. The client then calls Clerk's
// `user.delete()` to drop the Clerk record too; the order
// (backend first, then Clerk) means a Clerk-delete failure
// leaves the user signed in but with empty data, which they
// can recover from by re-signing-out — vs. losing access to
// Clerk but leaving orphaned rows in D1. Idempotent: re-
// calling with the same Clerk id is a no-op once the rows
// are gone.
export async function handleAccount(ctx: RouteContext): Promise<Response> {
  const { request, env, segments, clerkUserId } = ctx;
  if (!(segments[1] === 'account' && segments.length === 2)) return notFound();
  if (request.method === 'DELETE') {
    if (!clerkUserId) return missingAuth();
    const deleted = await deleteAccount(env, clerkUserId);
    return json({ deleted });
  }
  return notFound();
}
