// /api/migrate — guest -> authed (and legacy guest -> signed-guest)
// ownership migration.

import { guestSignatureEnforced, isClerkIdShape } from '../auth/guest-rest';
import { verifyOwnerId } from '../auth/owner-signature';
import { migrateOwnerId } from '../db';
import { badRequest, forbidden, json, missingAuth, notFound } from '../responses';
import type { RouteContext } from './context';

const ZERO = { diagrams: 0, folders: 0, shared: 0, images: 0 };

// Moves every `owner_id` row (diagrams, folders, prefs, images, shared
// list) from a source owner to a target owner. Two flows:
//
//  1. Sign-up (guest → Clerk): the live app calls this once Clerk reports
//     a session, to bind the caller's guest data to their account. The
//     SOURCE guest id must prove possession via its HMAC signature
//     (`guestSignature`) when signing is configured — otherwise anyone who
//     merely observed a guest's id (it leaks via DTOs / presence) could
//     claim that guest's entire data set. See auth/owner-signature.ts.
//
//  2. Legacy upgrade (unsigned guest → freshly-minted signed guest): an
//     existing guest created before signing shipped has an unsigned id and
//     so can't satisfy flow 1. The live app mints a signed id (POST
//     /api/guest-id) and calls this with no Clerk token to move the old
//     data onto the new id. The SOURCE here is the caller's current
//     `X-Owner-Id` (the same bearer credential every guest request uses);
//     the TARGET is the new signed id, proven by `toSignature`. NOTE: the
//     source is only bearer-authenticated, so this path carries the same
//     residual exposure as the pre-signing guest model for legacy ids
//     during the transition window (spec/04). New guests never use it.
//
// Idempotent: a no-op (source == target) moves zero rows.
export async function handleMigrate(ctx: RouteContext): Promise<Response> {
  const { request, env, segments, clerkUserId, resolveOwner } = ctx;
  if (!(segments[1] === 'migrate' && segments.length === 2)) return notFound();
  if (request.method !== 'POST') return notFound();

  const body = (await request.json().catch(() => null)) as {
    guestOwnerId?: string;
    guestSignature?: string | null;
    toOwnerId?: string;
    toSignature?: string | null;
  } | null;
  const secret = env.GUEST_ID_HMAC_SECRET;

  // Flow 1 — sign-up: claim guest data into the Clerk account.
  if (clerkUserId) {
    const fromOwnerId = body?.guestOwnerId?.trim();
    if (!fromOwnerId) return badRequest('guestOwnerId is required');
    if (fromOwnerId === clerkUserId) return json({ migrated: ZERO });
    // Possession proof: the caller must hold the source id's signature.
    if (secret && !(await verifyOwnerId(secret, fromOwnerId, body?.guestSignature))) {
      return forbidden();
    }
    const migrated = await migrateOwnerId(env, fromOwnerId, clerkUserId);
    return json({ migrated });
  }

  // Flow 2 — legacy upgrade (guest -> signed guest). Only meaningful when
  // signing is on; with no secret there are no signed ids to upgrade to.
  if (!secret) return missingAuth();
  const fromOwnerId = resolveOwner();
  const toOwnerId = body?.toOwnerId?.trim();
  if (!fromOwnerId) return missingAuth();
  // The source here is only the unsigned bearer header, so it must never be
  // an account id: Clerk ids are harvestable (team member lists), and this
  // path would otherwise move a signed-up user's whole workspace to whoever
  // names it. The global Clerk-shape refusal in index.ts only covers
  // OWNER_SCOPED_SEGMENTS, which deliberately leaves `migrate` out.
  if (isClerkIdShape(fromOwnerId)) return forbidden();
  // Once enforcement is armed the legacy window is over: an unsigned source
  // can no longer reach its own data, so it can't move it either.
  if (
    guestSignatureEnforced(env, Date.now()) &&
    !(await verifyOwnerId(secret, fromOwnerId, request.headers.get('X-Owner-Sig')))
  ) {
    return forbidden();
  }
  if (!toOwnerId) return badRequest('toOwnerId is required');
  if (fromOwnerId === toOwnerId) return json({ migrated: ZERO });
  if (!(await verifyOwnerId(secret, toOwnerId, body?.toSignature))) return forbidden();
  const migrated = await migrateOwnerId(env, fromOwnerId, toOwnerId);
  return json({ migrated });
}
