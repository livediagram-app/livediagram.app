// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { DEVICE_PREFERENCES } from '@liveworkspace/settings/device';
import { createDeviceSettingsStore, splitDeviceSettings } from './device-store';

const KEY = DEVICE_PREFERENCES['liveplanner.app'].storageKey;
const MARK = DEVICE_PREFERENCES['liveplanner.app'].unsyncedKey;
const stored = () => JSON.parse(localStorage.getItem(KEY) ?? 'null') as unknown;

afterEach(() => localStorage.clear());

describe('the device store (a guest’s settings in this browser)', () => {
  const store = createDeviceSettingsStore('liveplanner.app', { ownerId: () => 'guest_1' });

  it('uses the key and shape the editor keeps', () => {
    expect(KEY).toBe('liveplanner:user-preferences:v1');
    expect(MARK).toBe('liveplanner:user-preferences:unsynced');
  });

  it('reads the editor’s flat copy as the two scopes', async () => {
    localStorage.setItem(
      KEY,
      JSON.stringify({ telemetryEnabled: false, reduceMotion: true, notifyProjectJoin: false }),
    );
    expect(await store.loadApp('liveplanner.app')).toEqual({
      ok: true,
      data: {
        all: { telemetryEnabled: false, reduceMotion: true },
        app: { notifyProjectJoin: false },
      },
    });
  });

  it('reads nothing, or something unreadable, as no settings', async () => {
    expect(await store.loadApp('liveplanner.app')).toEqual({
      ok: true,
      data: { all: {}, app: {} },
    });
    localStorage.setItem(KEY, '[1,2');
    expect(await store.loadApp('liveplanner.app')).toEqual({
      ok: true,
      data: { all: {}, app: {} },
    });
  });

  it('writes only the key a change names, over the freshest copy, and marks it unsynced for the guest', async () => {
    localStorage.setItem(KEY, JSON.stringify({ notifyProjectJoin: false }));
    await store.loadApp('liveplanner.app');
    // Another tab (the editor) changes a key meanwhile.
    localStorage.setItem(KEY, JSON.stringify({ notifyProjectJoin: false, uiScale: 1.25 }));
    const result = await store.patchApp('liveplanner.app', { notifyFormResponses: false });
    expect(stored()).toEqual({
      notifyProjectJoin: false,
      uiScale: 1.25,
      notifyFormResponses: false,
    });
    expect(result).toEqual({
      ok: true,
      data: {
        all: { uiScale: 1.25 },
        app: { notifyProjectJoin: false, notifyFormResponses: false },
      },
    });
    expect(localStorage.getItem(MARK)).toBe('guest_1');
  });

  it('removes a key patched to null, and writes shared keys into the same flat copy', async () => {
    localStorage.setItem(KEY, JSON.stringify({ notifyProjectJoin: false }));
    await store.patchApp('liveplanner.app', { notifyProjectJoin: null });
    expect(stored()).toEqual({});
    expect(await store.patchShared({ reduceMotion: true })).toEqual({
      ok: true,
      data: { all: { reduceMotion: true } },
    });
    expect(stored()).toEqual({ reduceMotion: true });
  });

  it('leaves the mark alone with no guest id', async () => {
    const anonymous = createDeviceSettingsStore('liveplanner.app', { ownerId: () => null });
    await anonymous.patchApp('liveplanner.app', { notifyProjectJoin: false });
    expect(localStorage.getItem(MARK)).toBeNull();
  });

  it('says so when the browser refuses storage, and sends nothing', async () => {
    const refusing = createDeviceSettingsStore('liveplanner.app', {
      ownerId: () => 'guest_1',
      storage: () => null,
    });
    expect(await refusing.loadApp('liveplanner.app')).toMatchObject({
      ok: false,
      error: 'storage_unavailable',
    });
    expect(await refusing.patchApp('liveplanner.app', { a: 1 })).toMatchObject({ ok: false });
    expect(await refusing.request('/settings')).toMatchObject({ ok: false });
  });

  it('splits on ALL_SETTING_KEYS', () => {
    expect(splitDeviceSettings({ notifyTips: false, formTourSeen: false })).toEqual({
      all: { notifyTips: false },
      app: { formTourSeen: false },
    });
  });
});
