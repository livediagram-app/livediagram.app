// Sending the preferences to the api (docs/specs/007-editor/user-preferences.md "Saving to the
// server"). Four rules, each from a way settings used to be lost:
//
// - Only what changed. A save sends the keys that differ from what the server last confirmed (each
//   whole, null for one removed), so a setting changed in another app, or another tab, since this
//   one loaded is never put back. Before the server's copy is known, the whole blob goes.
// - It fits. The api refuses a body past PREFERENCES_BODY_MAX outright, and every later save of
//   the whole blob with it, so the growable lists give up their oldest entries first.
// - One save at a time, the latest wins. Saves sent together could land out of order and leave
//   the server on an older blob; a save made while one is in flight replaces any still waiting.
// - A save that did not land keeps this device's copy. Until one succeeds, the next load lets the
//   local cache win over the server's (now older) blob and sends it again, rather than the
//   server reverting the settings it never received.

import type { WhiteboardShapeKey } from './whiteboard-shape-catalogue';
import type { UserPreferences } from './user-preferences';
import { apiPutPreferences, PREFERENCES_LOCAL_ONLY } from './api-client';
import {
  readLocalStorageSafe,
  removeLocalStorageSafe,
  writeLocalStorageSafe,
} from '@liveworkspace/workbench/lib/local-storage-safe';

// The most the whole blob may be, in characters of `{"prefs":...}`. The api takes a patch of up to
// twice this (apps/api/src/routes/preferences.ts PREFERENCES_PATCH_MAX, which checks
// `text.length`): never more than the blob plus a null for each key dropped. Mirrored, not imported:
// the worker is not a dependency of the editor.
export const PREFERENCES_BODY_MAX = 4096;

// Set while a save for this owner is waiting, in flight or refused; holds the owner id, so a
// different identity on this browser is not given this one's precedence.
export const PREFERENCES_UNSYNCED_KEY = 'livediagram:user-preferences:unsynced';

export function preferencesBodyLength(prefs: UserPreferences): number {
  return JSON.stringify({ prefs }).length;
}

type PickEntry = [WhiteboardShapeKey, readonly [number, number]];

// An old blob's list of canvases hidden from Recent: nothing reads it, so it is the first to go.
const DEAD_HIDDEN_KEY = 'recentExcludedIds';

// The shape picks, least recently used first.
function picksOldestFirst(picks: UserPreferences['whiteboardShapePicks']): PickEntry[] {
  return (Object.entries(picks ?? {}) as PickEntry[]).sort((x, y) => x[1][1] - y[1][1]);
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

// The blob, trimmed to fit the api's cap: an old blob's hidden-from-Recent list goes first, whole (nothing reads it:
// Hide from Recent is the index's, docs/specs/013-workspace/hide-from-recent.md), then the least recently used
// shape picks (docs/specs/023-draw-mode/draw-mode.md "Shape slots"). Every other key is a choice
// the person made once and stays whole. Unchanged (the same object) when it already fits; when
// trimming both lists cannot make it fit, the save is refused and the device copy is kept (see
// above). Each pass drops as many entries as the excess needs and measures once, so trimming is
// linear in the blob rather than one serialisation per dropped entry.
export function fitPreferences(prefs: UserPreferences): UserPreferences {
  let length = preferencesBodyLength(prefs);
  if (length <= PREFERENCES_BODY_MAX) return prefs;
  let next = prefs;
  let dropped = 0;
  while (length > PREFERENCES_BODY_MAX) {
    const excess = length - PREFERENCES_BODY_MAX;
    const picks = picksOldestFirst(next.whiteboardShapePicks);
    if (DEAD_HIDDEN_KEY in next) {
      const { [DEAD_HIDDEN_KEY]: gone, ...rest } = next as UserPreferences &
        Record<string, unknown>;
      next = rest;
      dropped += Array.isArray(gone) ? gone.length : 1;
    } else if (picks.length > 0) {
      const sizes = picks.map(([k, v]) => JSON.stringify(k).length + 1 + JSON.stringify(v).length);
      const n = entriesFreeing(sizes, excess);
      next = { ...next, whiteboardShapePicks: Object.fromEntries(picks.slice(n)) };
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

type Blob = Record<string, unknown>;

// What the server last confirmed for the owner: its answer on load, then each save that landed.
let confirmed: { ownerId: string; prefs: Blob } | null = null;
// Owners this deployment keeps no preferences for: their choices stay in this browser.
const localOnly = new Set<string>();

export function rememberServerPreferences(ownerId: string, prefs: Blob): void {
  confirmed = { ownerId, prefs };
}

export function markPreferencesLocalOnly(ownerId: string): void {
  localOnly.add(ownerId);
  if (preferencesUnsynced(ownerId)) removeLocalStorageSafe(PREFERENCES_UNSYNCED_KEY);
}

export function preferencesLocalOnly(ownerId: string): boolean {
  return localOnly.has(ownerId);
}

// The keys of `next` that differ from `base`, each whole, and null for each key `base` has and
// `next` dropped. Linear in the blob (at most PREFERENCES_BODY_MAX characters).
export function preferencesPatch(base: Blob, next: Blob): Blob {
  const patch: Blob = {};
  for (const [key, value] of Object.entries(next)) {
    if (JSON.stringify(value) !== JSON.stringify(base[key])) patch[key] = value;
  }
  for (const key of Object.keys(base)) if (!(key in next)) patch[key] = null;
  return patch;
}

let inFlight = false;
let waiting: { ownerId: string; prefs: UserPreferences } | null = null;
// Bumped by the test seam, so a drain begun before a reset stops rather than taking the next save.
let generation = 0;

async function drain(): Promise<void> {
  inFlight = true;
  const run = generation;
  try {
    while (waiting && run === generation) {
      const save = waiting;
      waiting = null;
      const blob = save.prefs as Blob;
      const base = confirmed?.ownerId === save.ownerId ? confirmed.prefs : null;
      const patch = base ? preferencesPatch(base, blob) : blob;
      if (Object.keys(patch).length === 0) {
        if (!waiting) removeLocalStorageSafe(PREFERENCES_UNSYNCED_KEY);
        continue;
      }
      const result = await apiPutPreferences(save.ownerId, patch);
      if (run !== generation) return;
      if (result === PREFERENCES_LOCAL_ONLY) {
        markPreferencesLocalOnly(save.ownerId);
        waiting = null;
      } else if (!result) {
        console.warn('[preferences] save-not-confirmed, device copy kept');
      } else {
        confirmed = { ownerId: save.ownerId, prefs: base ? { ...base, ...blob } : blob };
        for (const key of Object.keys(patch)) if (patch[key] === null) delete confirmed.prefs[key];
        if (!waiting) removeLocalStorageSafe(PREFERENCES_UNSYNCED_KEY);
      }
    }
  } finally {
    if (run === generation) inFlight = false;
  }
}

// Queue the blob for the server; only what changed is sent (above). Marked unsynced at once, so a
// tab closed mid-save still keeps its copy on the next load. Nothing goes for an owner whose
// preferences stay in this browser.
export function savePreferences(ownerId: string, prefs: UserPreferences): void {
  if (localOnly.has(ownerId)) return;
  writeLocalStorageSafe(PREFERENCES_UNSYNCED_KEY, ownerId);
  waiting = { ownerId, prefs };
  if (!inFlight) void drain();
}

// Test seam: forget any queued save and what the server confirmed.
export function __resetPreferencesSync(): void {
  generation += 1;
  inFlight = false;
  waiting = null;
  confirmed = null;
  localOnly.clear();
}
