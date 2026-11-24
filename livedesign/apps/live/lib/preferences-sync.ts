// livedesign's binding of the editors' one preferences store (docs/specs/007-editor/user-preferences.md "Saving to the
// server", liveworkspace/docs/specs/011-workbench/editor-preferences.md): its keys, its trim, its pause and its api
// calls. The load, merge, write and save queue are the shared store's.

import { upgradeLegacyPreferences } from '@livedesign/api-schema';
import { USER_PREFERENCES_STORAGE_KEY } from '@livedesign/telemetry-client';
import {
  fitPreferences as fitToCap,
  PREFERENCES_BODY_MAX,
  preferencesBodyLength,
} from '@liveworkspace/workbench/lib/preferences/preferences-fit';
import { createPreferencesStore } from '@liveworkspace/workbench/lib/preferences/preferences-store';
import type { UserPreferences } from './user-preferences';
import { apiGetPreferences, apiPutPreferences } from './api-client';
import { getWorkbenchConfinement } from './api/workbench-confinement';

export { PREFERENCES_BODY_MAX, preferencesBodyLength };

export const PREFERENCES_CHANGED_EVENT = 'livedesign:preferences-changed';
// How long a change waits for the next before it is sent: the time between two steps of a slider drag or two quick
// clicks, and short enough that a tab closed after a change has usually sent it (pagehide sends it at once, and a save
// that never landed is resent on the next load). Safe range 200..2000 ms.
export const PREFERENCES_SAVE_DEBOUNCE_MS = 400;
// Set while a save for this owner is waiting, in flight or refused; holds the owner id (or `*` for a change made
// before anyone was known), so a different identity on this browser is not given this one's precedence.
export const PREFERENCES_UNSYNCED_KEY = 'livedesign:user-preferences:unsynced';
// The account's copy as this browser last agreed it, what a load's merge measures each side's changes against.
export const PREFERENCES_SERVER_KEY = 'livedesign:user-preferences:server';

// The blob, trimmed to fit the api's cap: an old blob's list of designs hidden from Recent goes, from before Recent
// moved to liveworkspace's index (docs/specs/013-workspace/hide-from-recent.md); nothing reads it.
export function fitPreferences(prefs: UserPreferences): UserPreferences {
  return fitToCap(prefs, { deadKeys: ['recentExcludedIds'] });
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
    return remote === 'not_stored' ? 'local' : remote;
  },
  put: async (ownerId, patch) => {
    const result = await apiPutPreferences(ownerId, patch);
    if (result === 'not_stored') return 'local';
    return result === 'saved' ? 'saved' : 'failed';
  },
  confined: () => getWorkbenchConfinement() !== null,
  debounceMs: PREFERENCES_SAVE_DEBOUNCE_MS,
});

// Whether this device holds preferences for `ownerId` that the server has not confirmed.
export const preferencesUnsynced = (ownerId: string): boolean => preferencesStore.unsynced(ownerId);
// Queue the set for the server, sent PREFERENCES_SAVE_DEBOUNCE_MS after the last change.
export const savePreferences = (ownerId: string, prefs: UserPreferences): void =>
  preferencesStore.save(ownerId, prefs);
// Sends a waiting change now rather than after the pause: the page is going away.
export const flushPreferences = (): void => preferencesStore.flush();
// Test seam: forget the page's loads, any queued save and what the server was known to hold.
export const __resetPreferencesSync = (): void => preferencesStore.reset();
