// livedocuments's binding of the editors' one preferences store (docs/specs/007-editor/user-preferences.md "Saving to
// the server", liveworkspace/docs/specs/011-workbench/editor-preferences.md): its keys, its trim, its pause and its api
// calls. The load, merge, write and save queue are the shared store's.

import { upgradeLegacyPreferences } from '@livedocuments/api-schema';
import { USER_PREFERENCES_STORAGE_KEY } from '@livedocuments/telemetry-client';
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

export const PREFERENCES_CHANGED_EVENT = 'livedocuments:preferences-changed';
// How long a change waits for the next, so a slider drag or a run of switches is one save.
export const SAVE_DEBOUNCE_MS = 400;
// Set while a save for this owner is waiting, in flight or refused; holds the owner id (or `*` for a change made
// before anyone was known), so a different identity on this browser is not given this one's precedence.
export const PREFERENCES_UNSYNCED_KEY = 'livedocuments:user-preferences:unsynced';
// The account's copy as this browser last agreed it, what a load's merge measures each side's changes against.
export const PREFERENCES_SERVER_KEY = 'livedocuments:user-preferences:server';

// Keys nothing reads any more, the first to go when the blob is over the cap.
export function fitPreferences(prefs: UserPreferences): UserPreferences {
  return fitToCap(prefs, { deadKeys: ['customSwatches', 'drawPattern'] });
}

export const preferencesStore = createPreferencesStore<UserPreferences>({
  storageKey: USER_PREFERENCES_STORAGE_KEY,
  unsyncedKey: PREFERENCES_UNSYNCED_KEY,
  serverKey: PREFERENCES_SERVER_KEY,
  changedEvent: PREFERENCES_CHANGED_EVENT,
  upgrade: (raw) => upgradeLegacyPreferences(raw) as UserPreferences,
  fit: fitPreferences,
  get: (ownerId) => apiGetPreferences(ownerId),
  put: (ownerId, patch) => apiPutPreferences(ownerId, patch),
  confined: () => getWorkbenchConfinement() !== null,
  debounceMs: SAVE_DEBOUNCE_MS,
});

// Whether this device holds preferences for `ownerId` that the server has not confirmed.
export const preferencesUnsynced = (ownerId: string): boolean => preferencesStore.unsynced(ownerId);
// Queue the blob for the server, sent SAVE_DEBOUNCE_MS after the last change.
export const savePreferences = (ownerId: string, prefs: UserPreferences): void =>
  preferencesStore.save(ownerId, prefs);
// Sends a waiting change now rather than after the pause: the page is going away.
export const flushPreferences = (): void => preferencesStore.flush();
// The api keeps no preferences for this owner: they stay in this browser.
export const keepPreferencesLocally = (ownerId: string): void =>
  preferencesStore.keepLocally(ownerId);
// Test seam: forget the page's loads, any queued save and what the server holds.
export const __resetPreferencesSync = (): void => preferencesStore.reset();
