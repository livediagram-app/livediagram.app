// A guest's settings for the Settings panel (liveworkspace/docs/specs/010-site/site.md "Settings", "A guest"): the copy the app's
// editor keeps in this browser on the app's own address, read and written in place of the accounts API. The editor
// holds one flat object (`<app>:user-preferences:v1`) with the `all` keys and its own side by side; the panel asks
// for the two scopes apart, as the accounts API answers, so this splits on read and writes back flat.
//
// Each write touches only the keys it names, over the freshest copy (an open editor tab may have changed another
// key since), and marks the copy unsynced for the guest, as the editor marks a save it hasn't sent: the editor's next
// load then keeps this copy over the server's and sends it on. Nothing here goes over the network.
import { isAllSetting, type SettingsBlob } from '@liveworkspace/settings';
import { DEVICE_PREFERENCES } from '@liveworkspace/settings/device';
import type { AppScopes } from './catalogue-model';
import type { SettingsApiResult } from './request';
import type { SettingsAppId, SettingsStore } from './store';

export interface DeviceSettingsOptions {
  // The guest's id (`guest_<uuid>`), the owner the editor syncs as; null leaves the mark alone.
  ownerId: () => string | null;
  // The browser's storage (a seam for tests); null when the browser refuses it.
  storage?: () => Storage | null;
}

const browserStorage = (): Storage | null => {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
};

const isPlainObject = (value: unknown): value is SettingsBlob =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** The editor's flat object as the two scopes. */
export function splitDeviceSettings(blob: SettingsBlob): AppScopes {
  const all: SettingsBlob = {};
  const app: SettingsBlob = {};
  for (const [key, value] of Object.entries(blob)) (isAllSetting(key) ? all : app)[key] = value;
  return { all, app };
}

const REFUSED = { ok: false, status: 0, error: 'storage_unavailable' } as const;

/** A store over the browser copy each app's editor keeps (`DEVICE_PREFERENCES`), for a guest on `home`'s address.
 *  Shared keys are written to `home`'s copy: that is the only copy this address has. */
export function createDeviceSettingsStore(
  home: SettingsAppId,
  { ownerId, storage = browserStorage }: DeviceSettingsOptions,
): SettingsStore {
  const read = (app: SettingsAppId): SettingsBlob | null => {
    const store = storage();
    if (!store) return null;
    let raw: string | null;
    try {
      raw = store.getItem(DEVICE_PREFERENCES[app].storageKey);
    } catch {
      return null;
    }
    if (!raw) return {};
    try {
      const parsed: unknown = JSON.parse(raw);
      return isPlainObject(parsed) ? parsed : {};
    } catch {
      return {};
    }
  };

  // A key set to null is removed, as the accounts API and the editor's own patch treat it.
  const write = (app: SettingsAppId, patch: SettingsBlob): SettingsApiResult<AppScopes> => {
    const store = storage();
    const current = read(app);
    if (!store || !current) return REFUSED;
    const next: SettingsBlob = { ...current };
    for (const [key, value] of Object.entries(patch)) {
      if (value === null || value === undefined) delete next[key];
      else next[key] = value;
    }
    const keys = DEVICE_PREFERENCES[app];
    try {
      store.setItem(keys.storageKey, JSON.stringify(next));
      const owner = ownerId();
      if (owner) store.setItem(keys.unsyncedKey, owner);
    } catch {
      return REFUSED;
    }
    return { ok: true, data: splitDeviceSettings(next) };
  };

  const request: SettingsStore['request'] = async () => REFUSED;
  return {
    request,
    async loadApp(app) {
      const blob = read(app);
      return blob ? { ok: true, data: splitDeviceSettings(blob) } : REFUSED;
    },
    // Always read afresh: the copy is local, and an editor tab may change it at any moment.
    remember() {},
    rememberShared() {},
    async patchApp(app, patch) {
      return write(app, patch);
    },
    async patchShared(patch) {
      const result = write(home, patch);
      return result.ok ? { ok: true, data: { all: result.data.all } } : result;
    },
    forget() {},
  };
}
