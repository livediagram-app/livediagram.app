// Single source of truth for the browser-local identity state that
// guests rely on (docs/specs/014-identity/auth-and-guest-access.md). The key strings used to be inlined at
// every read/write site across editor-page, the new-diagram page and
// the Clerk bootstrap hook — renaming the namespace or evolving the
// schema needed a grep + sweep across several files. Centralising
// them here means a v3 migration is a one-line edit and the intent
// of each piece of state is documented once.
//
// All accessors are SSR-safe (via the shared local-storage-safe
// helpers, which guard `typeof window` + swallow private-mode throws)
// so they can be called from module bodies or non-effect code paths
// without crashing the static export build.
//
// Namespace prefix: `livediagram:v2:`. The `v2` tag survives a
// future schema break — if the shape of a stored value changes
// incompatibly we'll bump to `v3:` and drop the old keys at read
// time so a returning guest doesn't end up with mixed-version state.

import {
  readLocalStorageSafe,
  removeLocalStorageSafe,
  writeLocalStorageSafe,
} from './local-storage-safe';
import { track } from './telemetry';

const NS = 'livediagram:v2:';

const KEYS = {
  // Per-browser guest participant id (`crypto.randomUUID()`),
  // carried to the api worker as `X-Owner-Id` until/unless the
  // user signs in with Clerk. See docs/specs/014-identity/auth-and-guest-access.md — "Hybrid identity".
  selfId: `${NS}self-id`,
  // HMAC signature of the guest id, minted by the api worker at
  // POST /api/guest-id (auth/owner-signature.ts). Replayed in the
  // /api/migrate body so the worker can prove the caller actually owns
  // the guest data it's claiming — observing the bare id is not enough.
  // Absent for legacy guests created before signing shipped, or when the
  // worker has no GUEST_ID_HMAC_SECRET configured. See docs/specs/014-identity/auth-and-guest-access.md.
  selfSig: `${NS}self-sig`,
  // Boolean flag — '1' once the user has confirmed their display
  // name via the welcome modal at least once. Used to suppress the
  // identity prompt on subsequent diagram opens. Only meaningful
  // for guests; signed-in users derive their name from Clerk.
  nameConfirmed: `${NS}name-confirmed`,
  // UTC day string (YYYY-MM-DD) of this browser's most recent app
  // open. Gates the once-per-day 'Participant'/'Returned' telemetry
  // signal (docs/specs/017-telemetry/telemetry.md) so a returning visitor counts once per UTC day,
  // not once per page load. Written by lib/daily-return.ts only.
  lastActiveDay: `${NS}last-active-day`,
  // Per-browser random used as the participant id in anything the
  // DOCUMENT records per person — the `responses` on a done check,
  // estimate card or temperature check (docs/specs/012-collaboration/participant-responses.md).
  //
  // Deliberately NOT `selfId`: that is the guest's owner id, an
  // `X-Owner-Id` credential, and writing it into a shared diagram would
  // hand it to every co-viewer. Deliberately not the room's presence id
  // either — that one is minted per socket (docs/specs/015-api/public-api-and-tokens.md §6), so it changes
  // on reconnect and matches nothing that was saved. This sits between
  // the two: stable like the owner id, worthless like the presence id.
  collabKey: `${NS}collab-key`,
} as const;

export function getGuestSelfId(): string | null {
  return readLocalStorageSafe(KEYS.selfId);
}

function setGuestSelfId(id: string): void {
  writeLocalStorageSafe(KEYS.selfId, id);
}

export function clearGuestSelfId(): void {
  removeLocalStorageSafe(KEYS.selfId);
  removeLocalStorageSafe(KEYS.selfSig);
}

export function getGuestSelfSig(): string | null {
  return readLocalStorageSafe(KEYS.selfSig);
}

// Persist the id + its signature together: they are a pair, and a
// signature without its matching id (or vice-versa) is useless. Pass
// `null` sig to clear it (e.g. a worker with signing disabled).
export function setGuestIdentity(id: string, sig: string | null): void {
  writeLocalStorageSafe(KEYS.selfId, id);
  if (sig) writeLocalStorageSafe(KEYS.selfSig, sig);
  else removeLocalStorageSafe(KEYS.selfSig);
}

// Read the existing guest id, or mint + persist a fresh one. The
// editor / new-diagram / explorer routes all need this exact "find
// or create" gesture as the X-Owner-Id fallback for signed-out
// visitors, and the inline `getGuestSelfId() ?? randomUUID() +
// setGuestSelfId()` chunk was duplicated at every call site. SSR-safe
// via the shared local-storage helpers: when storage is unavailable
// (no window, private mode, storage disabled) the mint still runs and
// returns a one-shot UUID, the call site just won't see it survive a
// reload.
export function ensureGuestSelfId(): string {
  const stored = getGuestSelfId();
  if (stored) return stored;
  const fresh = crypto.randomUUID();
  setGuestSelfId(fresh);
  // A fresh mint means a browser we've never seen: the daily
  // new-visitors signal (docs/specs/017-telemetry/telemetry.md). Returning visitors hit the
  // `stored` early-return above and never re-emit.
  reportParticipantCreated();
  return fresh;
}

// Set once this page load has counted a new visitor. Two mints can race
// inside one load: the signed mint (guest-identity.ts) awaits the network
// while a synchronous caller (TeamInviteJoin, /new's commit fallback) mints
// a local id, and with storage unavailable every call re-mints. Either way
// it is one browser, so it counts once.
let participantCreatedReported = false;

// The single emit point for `Participant`/`Created` (docs/specs/017-telemetry/telemetry.md), shared by the
// local mint above and the signed mint in guest-identity.ts.
export function reportParticipantCreated(): void {
  if (participantCreatedReported) return;
  participantCreatedReported = true;
  track('Participant', 'Created');
}

// Read the existing document-write key, or mint + persist a fresh one
// (see KEYS.collabKey). Called wherever a per-participant answer is
// written or matched, so both ends of that join always agree.
//
// Same SSR-safe fallback as the guest id above: with storage
// unavailable the mint still returns a usable one-shot value, and the
// only cost is that this browser's own answers don't survive a reload —
// which is exactly what happens to its diagrams too.
export function ensureCollabKey(): string {
  const stored = readLocalStorageSafe(KEYS.collabKey);
  if (stored) return stored;
  const fresh = crypto.randomUUID();
  writeLocalStorageSafe(KEYS.collabKey, fresh);
  return fresh;
}

// The UTC day this browser was last seen active, or null if never
// recorded. The daily-return signal (docs/specs/017-telemetry/telemetry.md) reads this to decide
// whether it has already counted today. See lib/daily-return.ts.
export function getLastActiveDay(): string | null {
  return readLocalStorageSafe(KEYS.lastActiveDay);
}

export function setLastActiveDay(day: string): void {
  writeLocalStorageSafe(KEYS.lastActiveDay, day);
}

export function hasConfirmedName(): boolean {
  return readLocalStorageSafe(KEYS.nameConfirmed) === '1';
}

export function markNameConfirmed(): void {
  writeLocalStorageSafe(KEYS.nameConfirmed, '1');
}
