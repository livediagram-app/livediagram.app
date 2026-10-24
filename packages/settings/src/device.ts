// Where each app's editor keeps a person's settings in the browser, on the app's own address (each app's
// docs/specs/007-editor/user-preferences.md, liveworkspace/docs/site.md "Settings", "A guest"): one flat JSON object
// holding the `all` keys and the app's own side by side, and the mark that says this browser's copy has a change the
// server hasn't confirmed. The Explorer on the app's address shares that origin, so it reads and writes a guest's
// settings here, and sets the mark so the editor's next load keeps this copy and sends it on.
//
// Each editor's settings-site-catalogue test pins its own STORAGE_KEY and PREFERENCES_UNSYNCED_KEY to these, so a
// renamed key fails there rather than silently splitting a guest's settings in two.

export interface DevicePreferenceKeys {
  // The editor's `STORAGE_KEY` (`USER_PREFERENCES_STORAGE_KEY` in the app's telemetry-client).
  storageKey: string;
  // The editor's `PREFERENCES_UNSYNCED_KEY`: holds the owner id whose copy the server hasn't confirmed.
  unsyncedKey: string;
}

const keysFor = (name: string): DevicePreferenceKeys => ({
  storageKey: `${name}:user-preferences:v1`,
  unsyncedKey: `${name}:user-preferences:unsynced`,
});

/** Each app's browser keys, by the app's site id (the accounts API's scope name). */
export const DEVICE_PREFERENCES = {
  'livediagram.app': keysFor('livediagram'),
  'liveplanner.app': keysFor('liveplanner'),
  'livedocuments.app': keysFor('livedocuments'),
  'livedesign.app': keysFor('livedesign'),
} as const satisfies Record<string, DevicePreferenceKeys>;
