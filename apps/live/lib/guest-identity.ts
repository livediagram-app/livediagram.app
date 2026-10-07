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
//     first, then adopt it. If the migrate cannot reach the worker, keep the
//     old id and retry next load rather than orphaning data; if the worker
//     refuses it (403), adopt the signed id, since the old one is locked out.
//   - Offline / mint fails / worker signing disabled: fall back to a
//     local unsigned id — today's behaviour. The guest still works; they
//     just can't prove possession until a later online bootstrap signs
//     them: with enforcement off the migrate moves their data; with it on,
//     the worker refuses and the browser adopts the signed id.

import {
  ensureGuestSelfId,
  getGuestSelfId,
  getGuestSelfSig,
  getPendingGuestUpgrade,
  reportParticipantCreated,
  setGuestIdentity,
  setPendingGuestUpgrade,
} from './local-identity';
import { apiMintGuestId, apiUpgradeGuestId } from './api/self';
import { debugLog } from '@/lib/debug-log';

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

// A guest whose mint was refused (offline, or its network's mint limit spent)
// is left on a local unsigned id, which a server enforcing signatures refuses
// on every call. A user's retry asks again: the signed identity when this
// browser holds none yet and a mint now succeeds, else null (nothing changed,
// so the caller keeps the identity it has). docs/specs/014-identity/auth-and-guest-access.md "Server-minted".
export async function retrySignedGuestIdentity(): Promise<GuestIdentity | null> {
  if (getGuestSelfSig()) return null;
  const identity = await ensureSignedGuestIdentity();
  return identity.sig ? identity : null;
}

async function resolveSignedGuestIdentity(): Promise<GuestIdentity> {
  const existingId = getGuestSelfId();
  const existingSig = getGuestSelfSig();
  if (existingId && existingSig) return { id: existingId, sig: existingSig };

  // An upgrade a reload interrupted: the worker may already hold the data under `to`. Repeat the
  // move for the same pair (moving already-moved data changes nothing) and adopt it; minting a
  // new id here would strand the data under one this browser never kept.
  const pending = getPendingGuestUpgrade();
  if (pending && pending.from === existingId) {
    const resumed = await apiUpgradeGuestId(pending.from, pending.to, pending.sig);
    if (resumed === 'failed') {
      console.warn('[guest-identity] resuming the signed-id upgrade failed; retrying next load');
      return { id: existingId, sig: existingSig };
    }
    if (resumed === 'refused') {
      console.warn('[guest-identity] the worker refused the upgrade; adopting the signed id');
    }
    setGuestIdentity(pending.to, pending.sig);
    setPendingGuestUpgrade(null);
    debugLog('[guest-identity] resumed an interrupted signed-id upgrade');
    return { id: pending.to, sig: pending.sig };
  }
  if (pending) setPendingGuestUpgrade(null);
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
    // Recorded first: a reload after the worker moves the data but before the id below is kept
    // resumes this same upgrade on the next load.
    setPendingGuestUpgrade({ from: existingId, to: minted.ownerId, sig: minted.ownerSig });
    const upgraded = await apiUpgradeGuestId(existingId, minted.ownerId, minted.ownerSig);
    if (upgraded === 'failed') {
      // Couldn't reach the worker: keep using the old (unsigned) id so
      // nothing is orphaned; a later load retries the upgrade.
      return { id: existingId, sig: existingSig };
    }
    if (upgraded === 'refused') {
      // A refusal is final: the old id's server data is unreachable under enforcement already, and
      // keeping the id would lock this browser out. Offline documents carry no guest id, so none
      // are lost. Typically an id minted locally when the first mint never landed.
      console.warn('[guest-identity] the worker refused the upgrade; adopting the signed id');
    }
  }
  setGuestIdentity(minted.ownerId, minted.ownerSig);
  setPendingGuestUpgrade(null);
  if (isNewVisitor) reportParticipantCreated();
  return { id: minted.ownerId, sig: minted.ownerSig };
}
