// livehuddle's binding of the editors' one preferences store (docs/specs/007-editor/user-preferences.md "Saving to the
// server", liveworkspace/docs/specs/011-workbench/editor-preferences.md): its keys, its trim and its api calls. The
// load, merge, write and save queue are the shared store's.

import { upgradeLegacyPreferences } from '@livehuddle/api-schema';
import { USER_PREFERENCES_STORAGE_KEY } from '@livehuddle/telemetry-client';
import {
  fitPreferences as fitToCap,
  PREFERENCES_BODY_MAX,
  preferencesBodyLength,
} from '@liveworkspace/workbench/lib/preferences/preferences-fit';
import { createPreferencesStore } from '@liveworkspace/workbench/lib/preferences/preferences-store';
import type { UserPreferences } from './user-preferences';
import { apiGetPreferences, apiPutPreferences, PREFERENCES_LOCAL_ONLY } from './api-client';

export { PREFERENCES_BODY_MAX, preferencesBodyLength };

export const PREFERENCES_CHANGED_EVENT = 'livehuddle:preferences-changed';
// Set while a save for this owner is waiting, in flight or refused; holds the owner id (or `*` for a change made
// before anyone was known), so a different identity on this browser is not given this one's precedence.
export const PREFERENCES_UNSYNCED_KEY = 'livehuddle:user-preferences:unsynced';
// The account's copy as this browser last agreed it, what a load's merge measures each side's changes against.
export const PREFERENCES_SERVER_KEY = 'livehuddle:user-preferences:server';

// The blob, trimmed to fit the api's cap: an old blob's hidden-from-Recent list goes first, whole (nothing reads it:
// Hide from Recent is the index's, docs/specs/013-workspace/hide-from-recent.md), then the least recently used shape
// picks (docs/specs/023-draw-mode/draw-mode.md "Shape slots").
export function fitPreferences(prefs: UserPreferences): UserPreferences {
  return fitToCap(prefs, { deadKeys: ['recentExcludedIds'], growableMap: 'whiteboardShapePicks' });
}

export const preferencesStore = createPreferencesStore<UserPreferences>({
  storageKey: USER_PREFERENCES_STORAGE_KEY,
  unsyncedKey: PREFERENCES_UNSYNCED_KEY,
  serverKey: PREFERENCES_SERVER_KEY,
  changedEvent: PREFERENCES_CHANGED_EVENT,
  upgrade: (raw) => upgradeLegacyPreferences(raw) as UserPreferences,
  fit: fitPreferences,
  get: async (ownerId) => {
    const remote = await apiGetPreferences(ownerId);
    return remote === PREFERENCES_LOCAL_ONLY ? 'local' : remote;
  },
  put: async (ownerId, patch) => {
    const result = await apiPutPreferences(ownerId, patch);
    if (result === PREFERENCES_LOCAL_ONLY) return 'local';
    return result ? 'saved' : 'failed';
  },
});

// Whether this device holds preferences for `ownerId` that the server has not confirmed.
export const preferencesUnsynced = (ownerId: string): boolean => preferencesStore.unsynced(ownerId);
// Queue the blob for the server; only what changed is sent.
export const savePreferences = (ownerId: string, prefs: UserPreferences): void =>
  preferencesStore.save(ownerId, prefs);
// Test seam: forget the page's loads, any queued save and what the server confirmed.
export const __resetPreferencesSync = (): void => preferencesStore.reset();
