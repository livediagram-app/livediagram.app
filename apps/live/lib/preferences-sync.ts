// Sending the preferences blob to the api (docs/specs/007-editor/user-preferences.md "Saving to the
// server"). Three rules, each from a way settings used to be lost:
//
// - It fits. The api refuses a body past PREFERENCES_BODY_MAX outright, and every later save of
//   the whole blob with it, so the growable lists give up their oldest entries first.
// - One save at a time, the latest wins. Saves sent together could land out of order and leave
//   the server on an older blob; a save made while one is in flight replaces any still waiting.
// - A save that did not land keeps this device's copy. Until one succeeds, the next load lets the
//   local cache win over the server's (now older) blob and sends it again, rather than the
//   server reverting the settings it never received.

import type { WhiteboardShapeKey } from './whiteboard-shape-catalogue';
import type { UserPreferences } from './user-preferences';
import { apiPutPreferences } from './api-client';
import {
  readLocalStorageSafe,
  removeLocalStorageSafe,
  writeLocalStorageSafe,
} from './local-storage-safe';

// The api's cap on a preferences PUT body, in characters of `{"prefs":...}`
// (apps/api/src/routes/preferences.ts, which checks `text.length`). Mirrored, not imported: the
// worker is not a dependency of the editor.
export const PREFERENCES_BODY_MAX = 4096;

// Set while a save for this owner is waiting, in flight or refused; holds the owner id, so a
// different identity on this browser is not given this one's precedence.
export const PREFERENCES_UNSYNCED_KEY = 'livediagram:user-preferences:unsynced';

export function preferencesBodyLength(prefs: UserPreferences): number {
  return JSON.stringify({ prefs }).length;
}

type PickEntry = [WhiteboardShapeKey, readonly [number, number]];

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

// The blob, trimmed to fit the api's cap: the oldest hidden-from-Recent ids go first (newest are
// kept at the front, docs/specs/013-workspace/hide-from-recent.md), then the least recently used
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
    const hidden = next.recentExcludedIds ?? [];
    const picks = picksOldestFirst(next.whiteboardShapePicks);
    if (hidden.length > 0) {
      const oldestFirst = [...hidden].reverse().map((id) => JSON.stringify(id).length);
      const n = entriesFreeing(oldestFirst, excess);
      next = { ...next, recentExcludedIds: hidden.slice(0, hidden.length - n) };
      dropped += n;
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

let inFlight = false;
let waiting: { ownerId: string; prefs: UserPreferences } | null = null;

async function drain(): Promise<void> {
  inFlight = true;
  try {
    while (waiting) {
      const save = waiting;
      waiting = null;
      const ok = await apiPutPreferences(save.ownerId, save.prefs as Record<string, unknown>);
      if (!ok) {
        console.warn('[preferences] save-not-confirmed, device copy kept');
      } else if (!waiting) {
        removeLocalStorageSafe(PREFERENCES_UNSYNCED_KEY);
      }
    }
  } finally {
    inFlight = false;
  }
}

// Queue the blob for the server. Marked unsynced at once, so a tab closed mid-save still keeps
// its copy on the next load.
export function savePreferences(ownerId: string, prefs: UserPreferences): void {
  writeLocalStorageSafe(PREFERENCES_UNSYNCED_KEY, ownerId);
  waiting = { ownerId, prefs };
  if (!inFlight) void drain();
}

// Test seam: forget any queued save.
export function __resetPreferencesSync(): void {
  inFlight = false;
  waiting = null;
}
