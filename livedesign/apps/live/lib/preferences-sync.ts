// Sending preferences to the api (docs/specs/007-editor/user-preferences.md "Saving to the
// server"), which keeps them with the person's liveworkspace account: the keys every app shares in
// its `all` scope, the rest in livedesign's own. Five rules, each from a way settings used to be lost
// or a cost they used to carry:
//
// - It fits. The growable lists give up their oldest entries first, so the set stays under
//   PREFERENCES_BODY_MAX and a scope never reaches the accounts Worker's cap.
// - Only what changed is sent, each key whole. A save is a patch: the keys whose value differs from
//   what the server last held, each with its whole value (an object such as `presentation` is never
//   sent in part, since the server replaces a value rather than merging into it), and null for a key
//   removed. So another app, or another tab, changing other keys meanwhile keeps its change.
// - Changes close together are one save. A slider dragged across its range, or a run of switches,
//   waits PREFERENCES_SAVE_DEBOUNCE_MS after the last change and goes as one request.
// - One save at a time, the latest wins. Saves sent together could land out of order; a change made
//   while one is in flight waits for it.
// - A save that did not land keeps this device's copy. Until one succeeds, the next load lets the
//   local cache win over the server's (now older) set and sends it again, rather than the server
//   reverting the settings it never received.
//
// A deployment with no liveworkspace accounts keeps no preferences (the api answers
// `preferences_not_stored`): they stay in this browser, and nothing more is sent this page load.

import type { UserPreferences } from './user-preferences';
import { apiPutPreferences, type PreferencesPatch } from './api-client';
import {
  readLocalStorageSafe,
  removeLocalStorageSafe,
  writeLocalStorageSafe,
} from './local-storage-safe';

// How big the whole set may grow, in characters of `{"prefs":...}`. The api takes a PUT body of twice
// this (apps/api/src/routes/preferences.ts PREFERENCES_PUT_MAX), so a patch of the whole set with a
// null for every key it removes always fits; the accounts Worker keeps up to 16 KB a scope.
export const PREFERENCES_BODY_MAX = 4096;

// How long a change waits for the next before it is sent: the time between two steps of a slider
// drag or two quick clicks, and short enough that a tab closed after a change has usually sent it
// (pagehide sends it at once, and a save that never landed is resent on the next load). Safe range
// 200..2000 ms.
export const PREFERENCES_SAVE_DEBOUNCE_MS = 400;

// Set while a save for this owner is waiting, in flight or refused; holds the owner id, so a
// different identity on this browser is not given this one's precedence.
export const PREFERENCES_UNSYNCED_KEY = 'livedesign:user-preferences:unsynced';

export function preferencesBodyLength(prefs: UserPreferences): number {
  return JSON.stringify({ prefs }).length;
}

// How many entries, taken in order, free at least `excess` characters: each costs its serialised
// size plus a comma. Off by at most one character (the last entry has no comma), which the next
// measurement catches.
function entriesFreeing(sizes: readonly number[], excess: number): number {
  let saved = 0;
  let n = 0;
  while (n < sizes.length && saved < excess) saved += sizes[n++]! + 1;
  return n;
}

// The blob, trimmed to fit the api's cap: the oldest hidden-from-Recent ids go (newest are kept at
// the front, docs/specs/013-workspace/hide-from-recent.md). Every other key is a choice the person
// made once and stays whole. Unchanged (the same object) when it already fits; when trimming the
// list cannot make it fit, the save is refused and the device copy is kept (see above). Each pass drops as many entries as the excess needs and measures once, so trimming is
// linear in the blob rather than one serialisation per dropped entry.
export function fitPreferences(prefs: UserPreferences): UserPreferences {
  let length = preferencesBodyLength(prefs);
  if (length <= PREFERENCES_BODY_MAX) return prefs;
  let next = prefs;
  let dropped = 0;
  while (length > PREFERENCES_BODY_MAX) {
    const excess = length - PREFERENCES_BODY_MAX;
    const hidden = next.recentExcludedIds ?? [];
    if (hidden.length > 0) {
      const oldestFirst = [...hidden].reverse().map((id) => JSON.stringify(id).length);
      const n = entriesFreeing(oldestFirst, excess);
      next = { ...next, recentExcludedIds: hidden.slice(0, hidden.length - n) };
      dropped += n;
    } else {
      break;
    }
    length = preferencesBodyLength(next);
  }
  console.warn(`[preferences] trimmed to fit dropped=${dropped} length=${length}`);
  return next;
}

// Whether this device holds preferences for `ownerId` that the server has not confirmed.
export function preferencesUnsynced(ownerId: string): boolean {
  return readLocalStorageSafe(PREFERENCES_UNSYNCED_KEY) === ownerId;
}

// What the server holds for each owner, as far as this page knows: the set fetched at load, then each
// set a save confirmed. A save sends what differs from it.
const synced = new Map<string, UserPreferences>();
// The api answered that this deployment keeps no preferences: they stay in this browser.
let serverKeepsNone = false;

export function markPreferencesSynced(ownerId: string, prefs: UserPreferences): void {
  synced.set(ownerId, prefs);
}

export function markPreferencesNotStored(ownerId: string): void {
  serverKeepsNone = true;
  if (preferencesUnsynced(ownerId)) removeLocalStorageSafe(PREFERENCES_UNSYNCED_KEY);
}

export function preferencesStoredOnServer(): boolean {
  return !serverKeepsNone;
}

// The keys of `next` whose value differs from `base`, each whole, and null for each key `base` has
// that `next` does not. With no base (nothing fetched yet), every key of `next`, and no deletions.
export function preferencesPatch(
  base: UserPreferences | undefined,
  next: UserPreferences,
): PreferencesPatch {
  const before = (base ?? {}) as Record<string, unknown>;
  const after = next as Record<string, unknown>;
  const patch: PreferencesPatch = {};
  for (const [key, value] of Object.entries(after)) {
    if (value === undefined) continue;
    if (!base || JSON.stringify(value) !== JSON.stringify(before[key])) patch[key] = value;
  }
  if (base) for (const key of Object.keys(before)) if (after[key] === undefined) patch[key] = null;
  return patch;
}

let inFlight = false;
let waiting: { ownerId: string; prefs: UserPreferences } | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;

async function drain(): Promise<void> {
  inFlight = true;
  try {
    while (waiting) {
      const save = waiting;
      waiting = null;
      const patch = preferencesPatch(synced.get(save.ownerId), save.prefs);
      const result =
        Object.keys(patch).length === 0 ? 'saved' : await apiPutPreferences(save.ownerId, patch);
      if (result === 'not_stored') {
        markPreferencesNotStored(save.ownerId);
        waiting = null;
        return;
      }
      if (result === 'refused') {
        console.warn('[preferences] save-not-confirmed, device copy kept');
        continue;
      }
      synced.set(save.ownerId, save.prefs);
      if (!waiting && !timer) removeLocalStorageSafe(PREFERENCES_UNSYNCED_KEY);
    }
  } finally {
    inFlight = false;
  }
}

function sendNow(): void {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  if (!inFlight) void drain();
}

// Queue the set for the server, sent PREFERENCES_SAVE_DEBOUNCE_MS after the last change. Marked
// unsynced at once, so a tab closed before it is sent keeps its copy on the next load.
export function savePreferences(ownerId: string, prefs: UserPreferences): void {
  if (serverKeepsNone) return;
  writeLocalStorageSafe(PREFERENCES_UNSYNCED_KEY, ownerId);
  waiting = { ownerId, prefs };
  if (timer) clearTimeout(timer);
  timer = setTimeout(sendNow, PREFERENCES_SAVE_DEBOUNCE_MS);
}

// Sends a waiting change now rather than after the pause: the page is going away.
export function flushPreferences(): void {
  if (timer) sendNow();
}

if (typeof window !== 'undefined') window.addEventListener('pagehide', flushPreferences);

// Test seam: forget any queued save and what the server was known to hold.
export function __resetPreferencesSync(): void {
  if (timer) clearTimeout(timer);
  timer = null;
  inFlight = false;
  waiting = null;
  synced.clear();
  serverKeepsNone = false;
}
