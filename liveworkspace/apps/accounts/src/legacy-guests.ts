// Returning guests of the old livediagram.app (liveworkspace/docs/accounts.md "Returning guests of the old
// livediagram.app", docs/migration.md step 6). Their copied work is under `guest_<old uuid>`, which no browser is
// ever handed; the new editor finds the old id in the browser and livediagram's api forwards it here with its
// client credentials. This checks the browser really holds it (the old signature, or for an id from before signing
// that the old site saw it then) and merges it into the caller, a guest or an account, through the index.

import {
  LEGACY_GUEST_SIGNING_LIVE_AT,
  legacyGuestOwner,
  type LegacyGuestClaimAnswer,
} from '@liveworkspace/migration/contract';
import type { Env } from './env.ts';
import { guestMergeConfig, mergeGuestInto, type MergeConfig } from './guests.ts';
import { GUEST_ID, USER_ID } from './ids.ts';

// The old site's ids: `crypto.randomUUID()`, a lowercase v4 UUID.
const LEGACY_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
// An HMAC-SHA-256 in base64url without padding: 32 bytes, 43 characters.
const SIGNATURE = /^[A-Za-z0-9_-]{43}$/;
// How long a claim holds the row while it merges: far past the merge's own 5-second timeout, so a live claim is never
// overtaken, and short enough that one which died midway (its Worker gone) frees the id within the minute.
export const LEGACY_CLAIM_HOLD_MS = 60_000;

export type ClaimOutcome =
  | { status: 200; body: LegacyGuestClaimAnswer }
  | { status: 400 | 403 | 502 | 503; body: { error: string } };

type LegacyGuestRow = { firstSeenAt: number; claimedAt: number | null; claimedBy: string | null };

const refuse = (status: 400 | 403 | 502 | 503, error: string): ClaimOutcome => ({
  status,
  body: { error },
});

function fromBase64url(text: string): Uint8Array<ArrayBuffer> {
  const binary = atob(text.replaceAll('-', '+').replaceAll('_', '/'));
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

// The old site's signature: HMAC-SHA-256 of the UTF-8 bare id under the secret's UTF-8 bytes. crypto.subtle.verify
// compares in constant time.
export async function legacySignatureValid(
  legacyId: string,
  signature: string,
  secret: string,
): Promise<boolean> {
  if (!SIGNATURE.test(signature)) return false;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify'],
  );
  return crypto.subtle.verify('HMAC', key, fromBase64url(signature), encoder.encode(legacyId));
}

export type ClaimConfig = {
  db: D1Database;
  secret: string;
  merge: MergeConfig;
  now?: number;
};

export function legacyClaimConfig(env: Env, secret: string): ClaimConfig {
  return { db: env.AUTH_DB, secret, merge: guestMergeConfig(env) };
}

// One claim. Possession is checked before anything is moved; the row is held while the merge runs, so two claims at
// once can't both merge, and stamped only once the index has merged.
export async function claimLegacyGuest(
  config: ClaimConfig,
  body: Record<string, unknown>,
): Promise<ClaimOutcome> {
  const { legacyId, signature, into } = body;
  if (typeof legacyId !== 'string' || !LEGACY_ID.test(legacyId)) {
    return refuse(400, 'invalid_legacy_id');
  }
  if (signature !== null && signature !== undefined && typeof signature !== 'string') {
    return refuse(400, 'invalid_signature');
  }
  const guestId = legacyGuestOwner(legacyId);
  if (
    typeof into !== 'string' ||
    !(USER_ID.test(into) || GUEST_ID.test(into)) ||
    into === guestId
  ) {
    return refuse(400, 'invalid_into');
  }
  const signed = typeof signature === 'string' && signature !== '';
  // A signature is checked before the row is read, so a forged one learns nothing of which ids were migrated.
  if (signed && !(await legacySignatureValid(legacyId, signature, config.secret))) {
    return refuse(403, 'bad_signature');
  }

  const row = await config.db
    .prepare('SELECT firstSeenAt, claimedAt, claimedBy FROM legacy_guest WHERE id = ?')
    .bind(guestId)
    .first<LegacyGuestRow>();
  if (!row) return { status: 200, body: { merged: false, reason: 'unknown' } };
  // An id from before signing: the old site's own rule, it must have been seen before signing went live.
  if (!signed && !(row.firstSeenAt < LEGACY_GUEST_SIGNING_LIVE_AT)) {
    return refuse(403, 'signature_required');
  }
  if (row.claimedAt !== null) {
    return row.claimedBy === into
      ? { status: 200, body: { merged: true } }
      : { status: 200, body: { merged: false, reason: 'claimed' } };
  }

  // Hold the row before anything moves, in one conditional update: of two claims at once only one merges, and the
  // other is told to come back (503, which livediagram's editor takes as "try on a later load"). A hold that lapsed
  // (its claim died midway) or is the caller's own (a retry) is taken over.
  const now = config.now ?? Date.now();
  const held = await config.db
    .prepare(
      `UPDATE legacy_guest SET claimingBy = ?, claimingUntil = ?
       WHERE id = ? AND claimedAt IS NULL
         AND (claimingUntil IS NULL OR claimingUntil <= ? OR claimingBy = ?)`,
    )
    .bind(into, now + LEGACY_CLAIM_HOLD_MS, guestId, now, into)
    .run();
  if ((held.meta.changes ?? 0) === 0) {
    const current = await config.db
      .prepare('SELECT claimedAt, claimedBy FROM legacy_guest WHERE id = ?')
      .bind(guestId)
      .first<Pick<LegacyGuestRow, 'claimedAt' | 'claimedBy'>>();
    if (current && current.claimedAt !== null) {
      return current.claimedBy === into
        ? { status: 200, body: { merged: true } }
        : { status: 200, body: { merged: false, reason: 'claimed' } };
    }
    return refuse(503, 'claim_in_progress');
  }

  if (!(await mergeGuestInto(config.merge, guestId, into, { legacy: true }))) {
    // Let the next try in at once rather than wait out the hold.
    await config.db
      .prepare(
        'UPDATE legacy_guest SET claimingBy = NULL, claimingUntil = NULL WHERE id = ? AND claimingBy = ?',
      )
      .bind(guestId, into)
      .run();
    return refuse(502, 'merge_failed');
  }
  const stamped = await config.db
    .prepare(
      `UPDATE legacy_guest SET claimedAt = ?, claimedBy = ?, claimingBy = NULL, claimingUntil = NULL
       WHERE id = ? AND claimedAt IS NULL`,
    )
    .bind(config.now ?? Date.now(), into, guestId)
    .run();
  if ((stamped.meta.changes ?? 0) === 0) {
    // Two claims at once: the other stamped first. Its merge took the items; ours found what was left, if anything.
    const winner = await config.db
      .prepare('SELECT claimedBy FROM legacy_guest WHERE id = ?')
      .bind(guestId)
      .first<string>('claimedBy');
    if (winner !== into) return { status: 200, body: { merged: false, reason: 'claimed' } };
  }
  console.log('[accounts] legacy guest claimed', {
    into: into.startsWith('guest_') ? 'guest' : 'account',
  });
  return { status: 200, body: { merged: true } };
}
