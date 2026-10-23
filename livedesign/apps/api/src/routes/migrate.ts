// /api/migrate — guest -> authed (and unsigned guest -> signed-guest)
// ownership migration.

import { isAccountIdShape } from '@livedesign/api-schema';
import { guestSignatureEnforced } from '../auth/guest-rest';
import { verifyOwnerId } from '../auth/owner-signature';
import { migrateOwnerId } from '../db';
import { badRequest, forbidden, json, missingAuth, notFound } from '../responses';
import { readOptionalBody, type RouteContext } from './context';

const ZERO = { designs: 0, folders: 0, shared: 0, images: 0 };

// Moves every `owner_id` row (designs, folders, images, shared list) from a
// source owner to a target owner, and the source's preferences, name and
// colour with the liveworkspace accounts Worker. Two flows:
//
//  1. Sign-up (guest → account): the live app calls this once sign-in reports
//     a session, to bind the caller's guest data to their account. The
//     SOURCE guest id must prove possession via its HMAC signature
//     (`guestSignature`) when signing is configured — otherwise anyone who
//     merely observed a guest's id (it leaks via DTOs / presence) could
//     claim that guest's entire data set. See auth/owner-signature.ts.
//
//  2. Signing upgrade (unsigned guest → freshly-minted signed guest): a guest
//     made before the deployment set GUEST_ID_HMAC_SECRET has an unsigned id
//     and so can't satisfy flow 1. The live app mints a signed id (POST
//     /api/guest-id) and calls this with no account token to move the old
//     data onto the new id. The SOURCE here is the caller's current
//     `X-Owner-Id` (the same bearer credential every guest request uses);
//     the TARGET is the new signed id, proven by `toSignature`. Once
//     enforcement is armed the source must carry its own signature too, so
//     an unsigned id can only upgrade during the grace window before
//     GUEST_SIG_ENFORCE_AFTER (docs/specs/014-identity/auth-and-guest-access.md).
//
// Idempotent: a no-op (source == target) moves zero rows.
export async function handleMigrate(ctx: RouteContext): Promise<Response> {
  const { request, env, segments, accountUserId, resolveOwner } = ctx;
  if (!(segments[1] === 'migrate' && segments.length === 2)) return notFound();
  if (request.method !== 'POST') return notFound();

  const body = (await readOptionalBody(request)) as {
    guestOwnerId?: unknown;
    guestSignature?: unknown;
    toOwnerId?: unknown;
    toSignature?: unknown;
  };
  const secret = env.GUEST_ID_HMAC_SECRET;

  // Flow 1 — sign-up: claim guest data into the account.
  if (accountUserId) {
    const fromOwnerId = typeof body.guestOwnerId === 'string' ? body.guestOwnerId.trim() : '';
    if (!fromOwnerId) return badRequest('guestOwnerId is required');
    if (fromOwnerId === accountUserId) return json({ migrated: ZERO });
    // A guest id is a server-minted UUID, never an account id. Without this,
    // a deployment with no GUEST_ID_HMAC_SECRET (the signature check below is
    // skipped) would let any signed-in user take over another account's whole
    // workspace by naming its (harvestable) account id.
    if (isAccountIdShape(fromOwnerId)) return forbidden();
    // Possession proof: the caller must hold the source id's signature.
    if (secret && !(await verifyOwnerId(secret, fromOwnerId, stringOrNull(body.guestSignature)))) {
      return forbidden();
    }
    const migrated = await migrateOwnerId(env, fromOwnerId, accountUserId);
    return json({ migrated });
  }

  // Flow 2 — signing upgrade (guest -> signed guest). Only meaningful when
  // signing is on; with no secret there are no signed ids to upgrade to.
  if (!secret) return missingAuth();
  const fromOwnerId = resolveOwner();
  const toOwnerId = typeof body.toOwnerId === 'string' ? body.toOwnerId.trim() : '';
  if (!fromOwnerId) return missingAuth();
  // The source here is only the unsigned bearer header, so it must never be
  // an account id: account ids are harvestable (team member lists), and this
  // path would otherwise move a signed-up user's whole workspace to whoever
  // names it. The global account-id-shape refusal in index.ts only covers
  // OWNER_SCOPED_SEGMENTS, which deliberately leaves `migrate` out.
  if (isAccountIdShape(fromOwnerId)) return forbidden();
  // Once enforcement is armed the source must prove possession: every id this
  // deployment minted since signing began carries its signature.
  if (
    guestSignatureEnforced(env, Date.now()) &&
    !(await verifyOwnerId(secret, fromOwnerId, request.headers.get('X-Owner-Sig')))
  ) {
    return forbidden();
  }
  if (!toOwnerId) return badRequest('toOwnerId is required');
  if (fromOwnerId === toOwnerId) return json({ migrated: ZERO });
  if (!(await verifyOwnerId(secret, toOwnerId, stringOrNull(body.toSignature)))) return forbidden();
  const migrated = await migrateOwnerId(env, fromOwnerId, toOwnerId);
  return json({ migrated });
}

// A signature as sent: anything but a string is no signature at all.
function stringOrNull(v: unknown): string | null {
  return typeof v === 'string' ? v : null;
}
