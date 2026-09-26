// Resolve a guest identity that is SIGNED wherever possible, so the
// sign-up migrate can later prove possession of the guest id rather than
// merely knowing it (docs/specs/014-identity/auth-and-guest-access.md — guest ids leak via DTOs / presence, so
// "knows the id" must not be enough to claim its data).
//
// States handled:
//   - Already signed ({id, sig} both stored): use it, no network.
//   - Legacy unsigned id (or no id): mint a server-signed id. If the
//     worker actually signs (GUEST_ID_HMAC_SECRET set) AND there was an
//     existing id with data, migrate that data onto the new signed id
//     first, then adopt it. If the migrate fails, keep the old id and
//     retry next load rather than orphaning data.
//   - Offline / mint fails / worker signing disabled: fall back to a
//     local unsigned id — today's behaviour. The guest still works; they
//     just can't prove possession until a later online bootstrap signs
//     them (the migrate then refuses, which is the safe failure).

import {
  ensureGuestSelfId,
  getGuestSelfId,
  getGuestSelfSig,
  reportParticipantCreated,
  setGuestIdentity,
} from './local-identity';
import { apiMintGuestId, apiUpgradeGuestId } from './api/self';

type GuestIdentity = { id: string; sig: string | null };

// Concurrent callers (the Explorer and its panels, a StrictMode double
// effect) share one resolution instead of each minting a different id, and
// each counting a new visitor, before the first one lands in storage.
let inflight: Promise<GuestIdentity> | null = null;

export function ensureSignedGuestIdentity(): Promise<GuestIdentity> {
  if (!inflight) {
    inflight = resolveSignedGuestIdentity().finally(() => {
      inflight = null;
    });
  }
  return inflight;
}

async function resolveSignedGuestIdentity(): Promise<GuestIdentity> {
  const existingId = getGuestSelfId();
  const existingSig = getGuestSelfSig();
  if (existingId && existingSig) return { id: existingId, sig: existingSig };
  // No id at all → this browser has never had a participant: the
  // daily new-visitors signal (docs/specs/017-telemetry/telemetry.md). Emitted per adopted branch
  // below rather than up here so the offline fallback doesn't double
  // count (ensureGuestSelfId reports its own mint), and through the
  // once-per-load reportParticipantCreated so a local mint that raced
  // this one's network round-trip doesn't count the browser twice.
  const isNewVisitor = !existingId;

  const minted = await apiMintGuestId();
  if (!minted) {
    // Offline / error: keep any existing id, else mint a local UUID.
    return { id: existingId ?? ensureGuestSelfId(), sig: null };
  }
  if (!minted.ownerSig) {
    // Worker signing disabled: keep an existing id (don't churn it), else
    // adopt the freshly generated (unsigned) one.
    const id = existingId ?? minted.ownerId;
    setGuestIdentity(id, null);
    if (isNewVisitor) reportParticipantCreated();
    return { id, sig: null };
  }
  // Worker returned a SIGNED id. Upgrade legacy data onto it if needed.
  if (existingId && existingId !== minted.ownerId) {
    const upgraded = await apiUpgradeGuestId(existingId, minted.ownerId, minted.ownerSig);
    if (!upgraded) {
      // Couldn't move the old data — keep using the old (unsigned) id so
      // nothing is orphaned; a later load retries the upgrade.
      return { id: existingId, sig: existingSig };
    }
  }
  setGuestIdentity(minted.ownerId, minted.ownerSig);
  if (isNewVisitor) reportParticipantCreated();
  return { id: minted.ownerId, sig: minted.ownerSig };
}
