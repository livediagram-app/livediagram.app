// Single source of truth for the browser-local identity state that
// guests rely on (spec/04). The key strings used to be inlined at
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
  // user signs in with Clerk. See spec/04 — "Hybrid identity".
  selfId: `${NS}self-id`,
  // HMAC signature of the guest id, minted by the api worker at
  // POST /api/guest-id (auth/owner-signature.ts). Replayed in the
  // /api/migrate body so the worker can prove the caller actually owns
  // the guest data it's claiming — observing the bare id is not enough.
  // Absent for legacy guests created before signing shipped, or when the
  // worker has no GUEST_ID_HMAC_SECRET configured. See spec/04.
  selfSig: `${NS}self-sig`,
  // Boolean flag — '1' once the user has confirmed their display
  // name via the welcome modal at least once. Used to suppress the
  // identity prompt on subsequent diagram opens. Only meaningful
  // for guests; signed-in users derive their name from Clerk.
  nameConfirmed: `${NS}name-confirmed`,
  // UTC day string (YYYY-MM-DD) of this browser's most recent app
  // open. Gates the once-per-day 'Participant'/'Returned' telemetry
  // signal (spec/22) so a returning visitor counts once per UTC day,
  // not once per page load. Written by lib/daily-return.ts only.
  lastActiveDay: `${NS}last-active-day`,
} as const;

export function getGuestSelfId(): string | null {
  return readLocalStorageSafe(KEYS.selfId);
}

export function setGuestSelfId(id: string): void {
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
  // new-visitors signal (spec/22). Returning visitors hit the
  // `stored` early-return above and never re-emit. The signed-mint
  // path (guest-identity.ts) emits its own event only when it
  // doesn't fall back to this helper, so a visitor counts once.
  track('Participant', 'Created');
  return fresh;
}

// The UTC day this browser was last seen active, or null if never
// recorded. The daily-return signal (spec/22) reads this to decide
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
