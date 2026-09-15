// HMAC-SHA256 signature over a guest owner-id.
//
// Why: a guest's owner-id (the `X-Owner-Id` UUID) is a bearer value that
// leaks — it rides in diagram DTOs and realtime presence frames. Without
// a signature, /api/migrate trusted a body-supplied `guestOwnerId` with no
// proof of possession, so anyone who *observed* a victim's id could claim
// all of that guest's diagrams into their own account. The fix is to bind
// possession to a secret the observer can't have:
//
//   - The signature is minted server-side at POST /api/guest-id, where the
//     SERVER chooses the id. A caller can therefore only ever hold a
//     signature for an id we handed *them* — never for an id they merely
//     saw elsewhere.
//   - The signature is never returned in any DTO or presence frame; only
//     the bare id is. So observing the id does not reveal the signature.
//   - /api/migrate verifies the signature before reassigning ownership.
//
// When `GUEST_ID_HMAC_SECRET` is unset (an OSS self-host that hasn't
// configured it), signing degrades to disabled — `signOwnerId` returns
// null and migrate skips the check — mirroring how `CLERK_JWKS_URL` makes
// auth optional. Production sets the secret and is protected.

import { timingSafeEqual } from './timing-safe';

const enc = new TextEncoder();

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
}

function toBase64Url(bytes: ArrayBuffer): string {
  const u = new Uint8Array(bytes);
  let s = '';
  for (let i = 0; i < u.length; i++) s += String.fromCharCode(u[i]!);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// The signature itself, for a secret the caller has already established.
// Split out so `verifyOwnerId` doesn't have to re-handle a null it cannot
// receive: with the "no secret" case answered once, both callers below work
// in terms of a string.
async function hmacSign(secret: string, ownerId: string): Promise<string> {
  const key = await hmacKey(secret);
  return toBase64Url(await crypto.subtle.sign('HMAC', key, enc.encode(ownerId)));
}

// Sign `ownerId`; returns null when no secret is configured (signing off).
export async function signOwnerId(
  secret: string | undefined,
  ownerId: string,
): Promise<string | null> {
  return secret ? hmacSign(secret, ownerId) : null;
}

// Constant-time verify of `sig` against `ownerId`. With a secret set, a
// missing or mismatched signature returns false. Callers gate on the
// secret being present before *requiring* a signature (so an unconfigured
// self-host keeps its legacy unsigned behaviour).
export async function verifyOwnerId(
  secret: string | undefined,
  ownerId: string,
  sig: string | null | undefined,
): Promise<boolean> {
  if (!secret) return true;
  if (!sig) return false;
  return timingSafeEqual(await hmacSign(secret, ownerId), sig);
}
