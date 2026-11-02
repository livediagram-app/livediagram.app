// A returning guest of the old livehuddle.app (docs/specs/014-identity/auth-and-guest-access.md "Returning guests
// from the old site"): its bare UUID and signature, left in this browser by the old editor on the same address,
// are claimed once the page has an identity of its own, so the work copied under `guest_<old uuid>` becomes the
// caller's. At most one attempt per page load; only an answer from the api forgets the keys.

import {
  readLocalStorageSafe,
  removeLocalStorageSafe,
} from '@liveworkspace/workbench/lib/local-storage-safe';
import { debugLog } from '@liveworkspace/workbench/lib/debug-log';
import { apiClaimLegacyGuest } from './api/migration';
import { notifyApiWrite } from './api/write-signal';
import { LOCAL_IDENTITY_KEYS } from './local-identity';
import { track } from './telemetry';

export const LEGACY_GUEST_ID_KEY = LOCAL_IDENTITY_KEYS.legacyGuestId;
export const LEGACY_GUEST_SIG_KEY = LOCAL_IDENTITY_KEYS.legacyGuestSig;

// The old site's ids are crypto.randomUUID()s: anything else was not written by it, and is never sent.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type LegacyGuestClaimOutcome =
  // Nothing to claim, or this page load already tried.
  | 'none'
  // The api merged the old guest into the caller: keys forgotten.
  | 'merged'
  // The api had nothing to merge (never migrated, or claimed already): keys forgotten.
  | 'forgotten'
  // A network failure or a refusal: keys kept for a later load.
  | 'kept';

let attempted = false;

export function hasLegacyGuest(): boolean {
  const id = readLocalStorageSafe(LEGACY_GUEST_ID_KEY);
  return id !== null && UUID.test(id);
}

// `ownerId`: the page's own identity, the signed-in account's id or this browser's guest id.
export async function claimLegacyGuest(ownerId: string): Promise<LegacyGuestClaimOutcome> {
  if (attempted || !hasLegacyGuest()) return 'none';
  attempted = true;
  const legacyId = readLocalStorageSafe(LEGACY_GUEST_ID_KEY)!.toLowerCase();
  const signature = readLocalStorageSafe(LEGACY_GUEST_SIG_KEY);
  try {
    const answer = await apiClaimLegacyGuest(ownerId, { legacyId, signature });
    removeLocalStorageSafe(LEGACY_GUEST_ID_KEY);
    removeLocalStorageSafe(LEGACY_GUEST_SIG_KEY);
    if (answer.merged) {
      debugLog('[legacy-guest] claimed');
      track('Participant', 'Moved', 'LegacyGuest');
      notifyApiWrite({ claimed: true });
      return 'merged';
    }
    debugLog(`[legacy-guest] nothing-to-claim reason=${answer.reason}`);
    track(
      'Participant',
      'Moved',
      answer.reason === 'claimed' ? 'LegacyGuestClaimed' : 'LegacyGuestUnknown',
    );
    return 'forgotten';
  } catch (err) {
    // apiFetch and expectOk have reported it; the next page load asks again.
    console.warn('[legacy-guest] claim-failed, kept for a later load', err);
    return 'kept';
  }
}

// Test seam: a fresh page load.
export function __resetLegacyGuestClaim(): void {
  attempted = false;
}
