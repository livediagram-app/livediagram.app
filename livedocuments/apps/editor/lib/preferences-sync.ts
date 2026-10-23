// Sending preferences to the api (docs/specs/007-editor/user-preferences.md "Saving to the server"),
// which keeps them in the liveworkspace accounts database, scoped to every app or to livedocuments.
// Four rules, each from a way settings used to be lost or a cost worth avoiding:
//
// - It fits. The whole blob stays within PREFERENCES_BODY_MAX, so a save is never refused for its
//   size and both of its scopes stay well inside the accounts database's limit; the growable lists
//   give up their oldest entries first.
// - Only what changed, coalesced. A save waits SAVE_DEBOUNCE_MS for the next one, then sends one
//   patch: each key that differs from what the server last held, its value whole, and null for a
//   key that went. A key another app changed meanwhile is never sent back, so it is never undone.
// - One save at a time, the latest wins. A save made while one is in flight waits for it.
// - A save that did not land keeps this device's copy. Until one succeeds, the next load lets the
//   local cache win over the server's (now older) preferences and sends it again.
//
// Where the server keeps none (a deployment without liveworkspace accounts), preferences stay in
// this browser and nothing is sent.

import type { UserPreferences } from './user-preferences';
import { apiPutPreferences } from './api-client';
import {
  readLocalStorageSafe,
  removeLocalStorageSafe,
  writeLocalStorageSafe,
} from './local-storage-safe';

// The most the whole preferences blob may take, in characters of `{"prefs":...}`. Safe range
// 2048..12288: the accounts database keeps at most 16 KB a scope.
export const PREFERENCES_BODY_MAX = 4096;

// How long a save waits for the next before it goes: a slider dragged, or a run of switches
// flipped, is one request. Safe range 100..2000.
export const SAVE_DEBOUNCE_MS = 400;

// Set while a save for this owner is waiting, in flight or refused; holds the owner id, so a
// different identity on this browser is not given this one's precedence.
export const PREFERENCES_UNSYNCED_KEY = 'livedocuments:user-preferences:unsynced';

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

// The blob, trimmed to fit: the oldest hidden-from-Recent ids go (newest are kept at the front,
// docs/specs/013-workspace/hide-from-recent.md). Every other key is a choice the person made once
// and stays whole. Unchanged (the same object) when it already fits. Each pass drops as many
// entries as the excess needs and measures once, so trimming is linear in the blob rather than one
// serialisation per dropped entry.
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

type Prefs = Record<string, unknown>;

// What the server holds for an owner, as last read or saved: what a save is measured against.
let server: { ownerId: string; prefs: Prefs } | null = null;
// The server said it keeps no preferences: this browser is their only home for the page's life.
let keptLocally = false;
let inFlight = false;
let waiting: { ownerId: string; prefs: Prefs } | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;

export function setServerPreferences(ownerId: string, prefs: Prefs): void {
  server = { ownerId, prefs };
}

export function keepPreferencesLocally(): void {
  keptLocally = true;
  waiting = null;
  if (timer !== null) clearTimeout(timer);
  timer = null;
  removeLocalStorageSafe(PREFERENCES_UNSYNCED_KEY);
}

export function preferencesKeptLocally(): boolean {
  return keptLocally;
}

const same = (a: unknown, b: unknown) => a === b || JSON.stringify(a) === JSON.stringify(b);

// What to send for `next`: every key that differs from the server's, whole, and null for a key the
// server has and `next` doesn't. With nothing known of the server, every key (and no deletes).
export function preferencesPatch(base: Prefs | null, next: Prefs): Prefs {
  const patch: Prefs = {};
  for (const [key, value] of Object.entries(next)) {
    if (value === undefined) continue;
    if (!base || !(key in base) || !same(base[key], value)) patch[key] = value;
  }
  if (base)
    for (const key of Object.keys(base))
      if (!(key in next) || next[key] === undefined) patch[key] = null;
  return patch;
}

async function drain(): Promise<void> {
  timer = null;
  if (inFlight) return;
  inFlight = true;
  try {
    while (waiting && !keptLocally) {
      const save = waiting;
      waiting = null;
      const base = server?.ownerId === save.ownerId ? server.prefs : null;
      const patch = preferencesPatch(base, save.prefs);
      if (Object.keys(patch).length === 0) {
        if (!waiting) removeLocalStorageSafe(PREFERENCES_UNSYNCED_KEY);
        continue;
      }
      const result = await apiPutPreferences(save.ownerId, patch);
      if (result === 'local') {
        keepPreferencesLocally();
      } else if (result === 'failed') {
        console.warn('[preferences] save-not-confirmed, device copy kept');
      } else {
        server = { ownerId: save.ownerId, prefs: save.prefs };
        if (!waiting) removeLocalStorageSafe(PREFERENCES_UNSYNCED_KEY);
      }
    }
  } finally {
    inFlight = false;
  }
  // A save that came in while the last was in flight goes on its own timer.
  if (waiting && timer === null && !keptLocally)
    timer = setTimeout(() => void drain(), SAVE_DEBOUNCE_MS);
}

// Queue the preferences for the server. Marked unsynced at once, so a tab closed before the save
// goes still keeps its copy on the next load.
export function savePreferences(ownerId: string, prefs: UserPreferences): void {
  if (keptLocally) return;
  writeLocalStorageSafe(PREFERENCES_UNSYNCED_KEY, ownerId);
  waiting = { ownerId, prefs };
  if (timer !== null) clearTimeout(timer);
  timer = setTimeout(() => void drain(), SAVE_DEBOUNCE_MS);
}

// Send what is waiting now rather than after the debounce: the page is being hidden or left.
export function flushPreferences(): void {
  if (timer === null) return;
  clearTimeout(timer);
  void drain();
}

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushPreferences();
  });
}

// Test seam: forget any queued save and what the server holds.
export function __resetPreferencesSync(): void {
  if (timer !== null) clearTimeout(timer);
  timer = null;
  inFlight = false;
  waiting = null;
  server = null;
  keptLocally = false;
}
