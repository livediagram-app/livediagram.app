// POST /api/guest-id — mint a signed guest owner-id.
//
// The SERVER generates the id (a fresh UUID) and returns it together with
// its HMAC signature. Because the id is server-chosen, a caller can only
// ever obtain a signature for an id we handed to them — never for an id
// they observed in someone else's diagram DTO or presence frame. The live
// app caches both and replays the signature in the /api/migrate body so
// the worker can prove the caller actually owns the guest data it's
// claiming (see auth/owner-signature.ts + docs/specs/014-identity/auth-and-guest-access.md).
//
// When GUEST_ID_HMAC_SECRET is unset (self-host that hasn't configured
// it), the endpoint still mints an id but with a null signature, and
// /api/migrate keeps its legacy unsigned behaviour.

import { signOwnerId } from '../auth/owner-signature';
import { json, notFound } from '../responses';
import type { RouteContext } from './context';

export async function handleGuestId(ctx: RouteContext): Promise<Response> {
  const { request, env, segments } = ctx;
  if (!(segments[1] === 'guest-id' && segments.length === 2)) return notFound();
  if (request.method !== 'POST') return notFound();
  const ownerId = crypto.randomUUID();
  const ownerSig = await signOwnerId(env.GUEST_ID_HMAC_SECRET, ownerId);
  return json({ ownerId, ownerSig });
}
