// Single source of truth for the browser-local identity state that
// guests rely on (docs/specs/014-identity/auth-and-guest-access.md). The key strings used to be inlined at
// every read/write site across editor-page, the new-project page and
// the account bootstrap hook — renaming the namespace or evolving the
// schema needed a grep + sweep across several files. Centralising
// them here means a v3 migration is a one-line edit and the intent
// of each piece of state is documented once.
//
// All accessors are SSR-safe (via the shared local-storage-safe
// helpers, which guard `typeof window` + swallow private-mode throws)
// so they can be called from module bodies or non-effect code paths
// without crashing the static export build.
//
// Namespace prefix: `liveplanner:v2:`. The `v2` tag survives a
// future schema break — if the shape of a stored value changes
// incompatibly we'll bump to `v3:` and drop the old keys at read
// time so a returning guest doesn't end up with mixed-version state.

import {
  readLocalStorageSafe,
  writeLocalStorageSafe,
} from '@liveworkspace/workbench/lib/local-storage-safe';
import { readGuestToken } from './guest-token';
import { GUEST_TOKEN_STORAGE_KEY } from './guest-token-key';
import { track } from './telemetry';

const NS = 'liveplanner:v2:';

const KEYS = {
  // The guest's id is its token's (lib/guest-token.ts, liveworkspace/docs/one-explorer-contracts.md "Guests"),
  // kept by the token module; it is listed here so a browser repair keeps it.
  guestToken: GUEST_TOKEN_STORAGE_KEY,
  // Boolean flag — '1' once the user has confirmed their display
  // name via the welcome modal at least once. Used to suppress the
  // identity prompt on subsequent project opens. Only meaningful
  // for guests; signed-in users derive their name from the account.
  nameConfirmed: `${NS}name-confirmed`,
  // UTC day string (YYYY-MM-DD) of this browser's most recent app
  // open. Gates the once-per-day 'Participant'/'Returned' telemetry
  // signal (docs/specs/017-telemetry/telemetry.md) so a returning visitor counts once per UTC day,
  // not once per page load. Written by lib/daily-return.ts only.
  lastActiveDay: `${NS}last-active-day`,
  // Per-browser random used as the participant id in anything the
  // PROJECT records per person — the `responses` on a done check,
  // estimate card or temperature check (docs/specs/012-collaboration/participant-responses.md).
  //
  // Deliberately NOT `selfId`: that is the guest's owner id, and
  // writing it into a shared project would
  // hand it to every co-viewer. Deliberately not the room's presence id
  // either — that one is minted per socket (docs/specs/015-api/public-api-and-tokens.md §6), so it changes
  // on reconnect and matches nothing that was saved. This sits between
  // the two: stable like the owner id, worthless like the presence id.
  collabKey: `${NS}collab-key`,
} as const;

// The keys, for the guard that every one a browser repair must keep is on its kept list
// (docs/specs/007-editor/load-recovery.md "Repairing a browser").
export const LOCAL_IDENTITY_KEYS = KEYS;

// The guest's id (`guest_<uuid>`, the same in every app), from its token; null with none.
export function getGuestSelfId(): string | null {
  return readGuestToken()?.id ?? null;
}

// The guest id as an external store (docs/specs/003-system-architecture/react-state-and-effects.md):
// another tab's new token arrives as a storage event.
export function subscribeGuestSelfId(onChange: () => void): () => void {
  const onStorage = (e: StorageEvent) => {
    if (e.key === null || e.key === KEYS.guestToken) onChange();
  };
  if (typeof window !== 'undefined') window.addEventListener('storage', onStorage);
  return () => {
    if (typeof window !== 'undefined') window.removeEventListener('storage', onStorage);
  };
}

// The guest id, or a stand-in for this page load when there is no guest token (the handoff could not run): the
// page still renders, and the api refuses what needs an identity, as it does for a link visitor.
let standIn: string | null = null;
export function ensureGuestSelfId(): string {
  const id = getGuestSelfId();
  if (id) return id;
  standIn ??= `guest_${crypto.randomUUID()}`;
  return standIn;
}

// Set once this page load has counted a new visitor, so it counts once.
let participantCreatedReported = false;

// The single emit point for `Participant`/`Created` (docs/specs/017-telemetry/telemetry.md): a guest token for a
// guest this browser has not had (guest-token.ts).
export function reportParticipantCreated(): void {
  if (participantCreatedReported) return;
  participantCreatedReported = true;
  track('Participant', 'Created');
}

// Read the existing project-write key, or mint + persist a fresh one
// (see KEYS.collabKey). Called wherever a per-participant answer is
// written or matched, so both ends of that join always agree.
//
// Same SSR-safe fallback as the guest id above: with storage
// unavailable the mint still returns a usable one-shot value, and the
// only cost is that this browser's own answers don't survive a reload —
// which is exactly what happens to its projects too.
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
