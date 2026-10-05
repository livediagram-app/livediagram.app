// Skipping the New Document wizard's Location step
// (docs/specs/013-workspace/default-folders.md "Skipping the Location step"): the
// `skipLocationStep` user preference, read, named, checked and written in one place.
//
// It holds the whole Location-step selection the reader ticked "Always save new documents in
// <place> and skip this step" for: the save location, the placement, and the place's name as it
// read then (the "Saving in" line and the Settings row show it without loading any folders).

import { parsePlacement } from '@/components/placement/PlacementBrowser';
import { debugLog } from './debug-log';
import { saveLocationLabel, SAVE_LOCATIONS, type SaveLocationId } from './save-locations';
import { track } from './telemetry';
import {
  readUserPreferences,
  writeUserPreferences,
  type UserPreferences,
} from './user-preferences';

export type SkipLocationStep = {
  saveLocation: SaveLocationId;
  // 'unsorted' | 'folder:<id>' | 'team:<id>' | 'team:<id>:folder:<id>'; 'unsorted' for 'browser'.
  placement: string;
  placeName: string;
};

/** What the wizard knows of the reader's places, to name and check a placement. */
export type SkipPlaceLists = {
  folders: { id: string; name: string }[];
  teams: { id: string; name: string }[];
  teamFolders: Record<string, { id: string; name: string }[]>;
};

// A folder name and a team name (each capped at 60 by NAME_MAX_LENGTH) plus the " · " joiner fit
// well inside this; it only guards the 4 KB preferences blob against a hand-edited value.
export const SKIP_PLACE_NAME_MAX = 160;

const PLACEMENT_PATTERN = /^(unsorted|folder:[^:]+|team:[^:]+(:folder:[^:]+)?)$/;

/** The name of the root of My documents, as every placement surface writes it. */
export const MY_DOCUMENTS = 'My documents';

/** The preference in force, or null when off. Anything malformed reads as off, never a crash. */
export function readSkipLocationStep(prefs: UserPreferences | undefined): SkipLocationStep | null {
  const raw = prefs?.skipLocationStep as unknown;
  if (typeof raw !== 'object' || raw === null) return null;
  const { saveLocation, placement, placeName } = raw as Record<string, unknown>;
  if (!SAVE_LOCATIONS.some((l) => l.id === saveLocation)) return null;
  if (typeof placement !== 'string' || !PLACEMENT_PATTERN.test(placement)) return null;
  if (typeof placeName !== 'string' || placeName.trim() === '') return null;
  return {
    saveLocation: saveLocation as SaveLocationId,
    // Local Browser has no folders: whatever was stored, it files at its own root.
    placement: saveLocation === 'browser' ? 'unsorted' : placement,
    placeName: placeName.slice(0, SKIP_PLACE_NAME_MAX),
  };
}

/** The preference to store for a Location-step selection. */
export function skipLocationStepFor(
  saveLocation: SaveLocationId,
  placement: string,
  placeName: string,
): SkipLocationStep {
  return saveLocation === 'browser'
    ? { saveLocation, placement: 'unsorted', placeName: saveLocationLabel(saveLocation) }
    : { saveLocation, placement, placeName: placeName.slice(0, SKIP_PLACE_NAME_MAX) };
}

/**
 * A selection as the reader sees it: "Local Browser", "My documents", a folder, a team, or a team
 * folder with its team ("Workshops · Design team"). Null when the lists do not hold it (yet).
 */
export function placeNameOf(
  saveLocation: SaveLocationId,
  placement: string,
  lists: SkipPlaceLists,
): string | null {
  if (saveLocation === 'browser') return saveLocationLabel(saveLocation);
  const { teamId, folderId } = parsePlacement(placement);
  if (!teamId) {
    if (!folderId) return MY_DOCUMENTS;
    return lists.folders.find((f) => f.id === folderId)?.name ?? null;
  }
  const team = lists.teams.find((t) => t.id === teamId)?.name;
  if (!team) return null;
  if (!folderId) return team;
  const folder = lists.teamFolders[teamId]?.find((f) => f.id === folderId)?.name;
  return folder ? `${folder} · ${team}` : null;
}

/** Whether the saved place still exists among the reader's loaded folders and teams. */
export function skipPlaceAvailable(step: SkipLocationStep, lists: SkipPlaceLists): boolean {
  if (step.saveLocation === 'browser') return true;
  return placeNameOf(step.saveLocation, step.placement, lists) !== null;
}

/** The log's scope word for a placement: never an id or a name. */
export function skipPlaceScope(placement: string): 'root' | 'personal' | 'team' {
  const { teamId, folderId } = parsePlacement(placement);
  return teamId ? 'team' : folderId ? 'personal' : 'root';
}

/** What a create sends for the saved place: always explicit, the root included. */
export function skipPlacementSent(step: SkipLocationStep): {
  folderId: string | null;
  teamId: string | null;
} {
  return parsePlacement(step.placement);
}

/** Turns skipping on (the wizard's Create), telemetry first. */
export function saveSkipLocationStep(step: SkipLocationStep, ownerId: string | null): void {
  track('UI', 'Toggled', 'SkipLocationStepOn');
  writeUserPreferences({ ...readUserPreferences(), skipLocationStep: step }, ownerId);
  debugLog(
    `[skip-location] saved location=${step.saveLocation} scope=${skipPlaceScope(step.placement)}`,
  );
}

/**
 * Turns skipping off (Settings' Turn Off), telemetry first: the preferences to write, with an
 * explicit null so it wins the merge over another device's stale cache.
 */
export function turnOffSkipLocationStep(prefs: UserPreferences): UserPreferences {
  track('UI', 'Toggled', 'SkipLocationStepOff');
  debugLog('[skip-location] cleared');
  return { ...prefs, skipLocationStep: null };
}

/**
 * Where this visit's wizard saves without asking, or null for the normal two steps. A `/new`
 * context wins for placement (in livediagram); a saved place the loaded lists no longer hold falls
 * back to the Location step (`unavailable` names its scope for the log). Until the lists are
 * `ready` the saved place stands: the server refuses one that has gone.
 */
export function resolveSkipLocation({
  pref,
  context,
  lists,
  ready,
}: {
  pref: SkipLocationStep | null;
  context: string | undefined;
  lists: SkipPlaceLists;
  ready: boolean;
}): { place: SkipLocationStep | null; unavailable: 'personal' | 'team' | null } {
  if (!pref) return { place: null, unavailable: null };
  if (context !== undefined) {
    const name = placeNameOf('livediagram', context, lists) ?? CONTEXT_PLACE_FALLBACK;
    return { place: skipLocationStepFor('livediagram', context, name), unavailable: null };
  }
  if (ready && !skipPlaceAvailable(pref, lists)) {
    const scope = skipPlaceScope(pref.placement);
    return { place: null, unavailable: scope === 'team' ? 'team' : 'personal' };
  }
  return { place: pref, unavailable: null };
}

/** The "Saving in" line's words for a context folder whose name has not loaded yet. */
export const CONTEXT_PLACE_FALLBACK = 'this folder';
