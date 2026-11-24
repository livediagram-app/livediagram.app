// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { preferencesKeptLocally } from '../preferences-local-only';
import { createPreferencesStore } from './preferences-store';
import type { PreferencesRead, PreferencesSaveResult } from './preferences-store';

type Prefs = Record<string, unknown>;

const KEY = 'test:user-preferences:v1';
const UNSYNCED = 'test:user-preferences:unsynced';
const SERVER = 'test:user-preferences:server';
const EVENT = 'test:preferences-changed';

let get: ReturnType<typeof vi.fn<(ownerId: string) => Promise<PreferencesRead>>>;
let put: ReturnType<
  typeof vi.fn<(ownerId: string, patch: Prefs) => Promise<PreferencesSaveResult>>
>;
let confined = false;

function makeStore(debounceMs = 0) {
  return createPreferencesStore<Prefs>({
    storageKey: KEY,
    unsyncedKey: UNSYNCED,
    serverKey: SERVER,
    changedEvent: EVENT,
    // Renames a legacy key and drops a retired one, as the apps' upgrades do.
    upgrade: (raw) => {
      const { oldName, retired: _retired, ...rest } = raw;
      return oldName === undefined ? rest : { newName: oldName, ...rest };
    },
    fit: (prefs) => prefs,
    get,
    put,
    confined: () => confined,
    debounceMs,
  });
}

let store = makeStore();
const cache = () => JSON.parse(localStorage.getItem(KEY) ?? 'null') as Prefs | null;
const agreed = () => JSON.parse(localStorage.getItem(SERVER) ?? 'null') as unknown;
const flushAsync = () => new Promise((resolve) => setTimeout(resolve, 0));

beforeEach(() => {
  localStorage.clear();
  document.cookie = 'lw_open_explorer=; max-age=0; path=/';
  get = vi.fn<(ownerId: string) => Promise<PreferencesRead>>();
  put = vi.fn<(ownerId: string, patch: Prefs) => Promise<PreferencesSaveResult>>();
  put.mockResolvedValue('saved');
  confined = false;
  store = makeStore();
});

afterEach(() => {
  store.reset();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('defaults', () => {
  it('sends at once and is never confined without those options', () => {
    const plain = createPreferencesStore<Prefs>({
      storageKey: KEY,
      unsyncedKey: UNSYNCED,
      serverKey: SERVER,
      changedEvent: EVENT,
      upgrade: (raw) => raw,
      fit: (prefs) => prefs,
      get,
      put,
    });
    plain.write({ a: 1 }, 'user_1');
    expect(put).toHaveBeenCalledWith('user_1', { a: 1 });
    plain.reset();
  });
});

describe('read', () => {
  it('is empty with nothing stored, malformed JSON or a non-object', () => {
    expect(store.read()).toEqual({});
    localStorage.setItem(KEY, '{nope');
    expect(store.read()).toEqual({});
    localStorage.setItem(KEY, '42');
    expect(store.read()).toEqual({});
  });

  it('upgrades what it reads and keeps unknown keys', () => {
    localStorage.setItem(KEY, JSON.stringify({ oldName: 1, future: 'x', retired: true }));
    expect(store.read()).toEqual({ newName: 1, future: 'x' });
  });
});

describe('write', () => {
  it('keeps the copy, fires the change event and sends it for an owner', () => {
    const heard = vi.fn();
    window.addEventListener(EVENT, heard);
    store.write({ a: 1 }, 'user_1');
    window.removeEventListener(EVENT, heard);
    expect(cache()).toEqual({ a: 1 });
    expect(heard).toHaveBeenCalledTimes(1);
    expect(put).toHaveBeenCalledWith('user_1', { a: 1 });
    expect(localStorage.getItem(UNSYNCED)).toBe('user_1');
  });

  it('sends nothing and marks nothing without an owner, or under the Offline placeholder', () => {
    store.write({ a: 1 });
    store.write({ a: 2 }, 'self');
    expect(put).not.toHaveBeenCalled();
    expect(localStorage.getItem(UNSYNCED)).toBeNull();
    expect(cache()).toEqual({ a: 2 });
  });

  it('keeps a workbench frame’s change in the frame: no save, no mark, no cookie', () => {
    confined = true;
    store.write({ a: 1, autoOpenExplorer: true }, 'user_1');
    expect(cache()).toEqual({ a: 1, autoOpenExplorer: true });
    expect(put).not.toHaveBeenCalled();
    expect(localStorage.getItem(UNSYNCED)).toBeNull();
    expect(document.cookie).not.toContain('lw_open_explorer=1');
  });

  it('mirrors Automatically Open Explorer into the cookie', () => {
    store.write({ autoOpenExplorer: true });
    expect(document.cookie).toContain('lw_open_explorer=1');
    store.write({ autoOpenExplorer: false });
    expect(document.cookie).not.toContain('lw_open_explorer=1');
  });

  it('commits a change rebased onto the freshest copy', () => {
    expect(store.rebase({ a: 1 }, { a: 2 })).toEqual({ a: 2 });
    localStorage.setItem(KEY, JSON.stringify({ a: 1, other: 'tab' }));
    expect(store.commit({ a: 1 }, { a: 3 })).toEqual({ a: 3, other: 'tab' });
    expect(cache()).toEqual({ a: 3, other: 'tab' });
  });
});

describe('saving', () => {
  it('sends only what changed since the server confirmed, null for what went', async () => {
    get.mockResolvedValue({ a: 1, b: 2 });
    await store.fetch('user_1');
    store.write({ a: 1, c: 3 }, 'user_1');
    await flushAsync();
    expect(put).toHaveBeenLastCalledWith('user_1', { c: 3, b: null });
    expect(localStorage.getItem(UNSYNCED)).toBeNull();
    expect(agreed()).toEqual({ ownerId: 'user_1', prefs: { a: 1, c: 3 } });
  });

  it('sends nothing when nothing changed, and clears the mark', async () => {
    get.mockResolvedValue({ a: 1 });
    await store.fetch('user_1');
    store.write({ a: 1 }, 'user_1');
    await flushAsync();
    expect(put).not.toHaveBeenCalled();
    expect(localStorage.getItem(UNSYNCED)).toBeNull();
  });

  it('sends one save at a time, the latest waiting one next', async () => {
    let land: (r: PreferencesSaveResult) => void = () => {};
    put.mockImplementationOnce(() => new Promise((resolve) => (land = resolve)));
    store.save('user_1', { a: 1 });
    store.save('user_1', { a: 2 });
    store.save('user_1', { a: 3 });
    expect(put).toHaveBeenCalledTimes(1);
    land('saved');
    await flushAsync();
    expect(put).toHaveBeenCalledTimes(2);
    expect(put).toHaveBeenLastCalledWith('user_1', { a: 3 });
  });

  it('keeps the mark when a save is not confirmed', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    put.mockResolvedValue('failed');
    store.save('user_1', { a: 1 });
    await flushAsync();
    expect(localStorage.getItem(UNSYNCED)).toBe('user_1');
    expect(console.warn).toHaveBeenCalledWith('[preferences] save-not-confirmed, device copy kept');
  });

  it('stops sending once the deployment keeps none', async () => {
    put.mockResolvedValue('local');
    store.save('user_1', { a: 1 });
    await flushAsync();
    expect(preferencesKeptLocally('user_1')).toBe(true);
    expect(localStorage.getItem(UNSYNCED)).toBeNull();
    store.save('user_1', { a: 2 });
    await flushAsync();
    expect(put).toHaveBeenCalledTimes(1);
  });

  it('drops a waiting save for an owner kept locally meanwhile', async () => {
    let land: (r: PreferencesSaveResult) => void = () => {};
    put.mockImplementationOnce(() => new Promise((resolve) => (land = resolve)));
    store.save('user_1', { a: 1 });
    store.save('user_2', { a: 2 });
    store.keepLocally('user_2');
    land('saved');
    await flushAsync();
    expect(put).toHaveBeenCalledTimes(1);
  });

  it('skips a queued save whose owner became local before it was sent', async () => {
    let land: (r: PreferencesSaveResult) => void = () => {};
    put.mockImplementationOnce(() => new Promise((resolve) => (land = resolve)));
    store.save('user_1', { a: 1 });
    store.save('user_2', { a: 2 });
    // Recorded by another reader (the Settings host), not through this store.
    const { rememberPreferencesKeptLocally } = await import('../preferences-local-only');
    rememberPreferencesKeptLocally('user_2');
    land('saved');
    await flushAsync();
    expect(put).toHaveBeenCalledTimes(1);
  });

  it("keeps another owner's waiting save when one owner is kept locally", async () => {
    vi.useFakeTimers();
    store = makeStore(400);
    store.save('user_1', { a: 1 });
    store.keepLocally('user_2');
    await vi.advanceTimersByTimeAsync(400);
    expect(put).toHaveBeenCalledWith('user_1', { a: 1 });
  });

  it('stops a drain begun before a reset', async () => {
    let land: (r: PreferencesSaveResult) => void = () => {};
    put.mockImplementationOnce(() => new Promise((resolve) => (land = resolve)));
    store.save('user_1', { a: 1 });
    store.reset();
    land('saved');
    await flushAsync();
    expect(agreed()).toBeNull();
  });

  describe('with a pause', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      store = makeStore(400);
    });

    it('coalesces changes into one save after the pause', async () => {
      store.save('user_1', { a: 1 });
      store.save('user_1', { a: 2 });
      expect(put).not.toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(400);
      expect(put).toHaveBeenCalledTimes(1);
      expect(put).toHaveBeenCalledWith('user_1', { a: 2 });
    });

    it('sends at once when the page is hidden or goes', async () => {
      store.save('user_1', { a: 1 });
      Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));
      expect(put).toHaveBeenCalledTimes(1);
      store.save('user_1', { a: 2 });
      window.dispatchEvent(new Event('pagehide'));
      await vi.advanceTimersByTimeAsync(0);
      expect(put).toHaveBeenCalledTimes(2);
      Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));
      store.flush();
      expect(put).toHaveBeenCalledTimes(2);
    });
  });
});

describe('loading', () => {
  it('answers null and leaves the copy when the read fails, and asks again next time', async () => {
    localStorage.setItem(KEY, JSON.stringify({ a: 1 }));
    get.mockResolvedValueOnce(null).mockResolvedValueOnce({ a: 2 });
    expect(await store.fetch('user_1')).toBeNull();
    expect(cache()).toEqual({ a: 1 });
    expect(await store.fetch('user_1')).toEqual({ a: 2 });
  });

  it('asks once per page load, a second caller reading the copy after the first answer', async () => {
    get.mockResolvedValue({ a: 1 });
    const [first, second] = await Promise.all([store.fetch('user_1'), store.fetch('user_1')]);
    expect(first).toEqual({ a: 1 });
    expect(second).toEqual({ a: 1 });
    store.write({ a: 2 });
    expect(await store.fetch('user_1')).toEqual({ a: 2 });
    expect(get).toHaveBeenCalledTimes(1);
  });

  it('a second caller after a failed first answers null too', async () => {
    let answer: (r: PreferencesRead) => void = () => {};
    get.mockImplementationOnce(() => new Promise((resolve) => (answer = resolve)));
    const first = store.fetch('user_1');
    const second = store.fetch('user_1');
    answer(null);
    expect(await first).toBeNull();
    expect(await second).toBeNull();
  });

  it('keeps the copy in this browser when the deployment keeps none', async () => {
    localStorage.setItem(KEY, JSON.stringify({ a: 1 }));
    localStorage.setItem(UNSYNCED, 'user_1');
    get.mockResolvedValue('local');
    expect(await store.fetch('user_1')).toBeNull();
    expect(cache()).toEqual({ a: 1 });
    expect(preferencesKeptLocally('user_1')).toBe(true);
    expect(localStorage.getItem(UNSYNCED)).toBeNull();
  });

  it('drops a key the server removed that this device had saved (a setting cleared elsewhere)', async () => {
    localStorage.setItem(KEY, JSON.stringify({ callSpace: 'room-1', mapSize: 'tall' }));
    localStorage.setItem(
      SERVER,
      JSON.stringify({ ownerId: 'user_1', prefs: { callSpace: 'room-1', mapSize: 'tall' } }),
    );
    get.mockResolvedValue({ mapSize: 'tall' });
    expect(await store.fetch('user_1')).toEqual({ mapSize: 'tall' });
    expect(cache()).toEqual({ mapSize: 'tall' });
    expect(agreed()).toEqual({ ownerId: 'user_1', prefs: { mapSize: 'tall' } });
    expect(put).not.toHaveBeenCalled();
  });

  it('keeps an unsaved local change over the server and sends it, while a removed key still goes', async () => {
    localStorage.setItem(KEY, JSON.stringify({ callSpace: 'room-1', mapSize: 'tall' }));
    localStorage.setItem(
      SERVER,
      JSON.stringify({ ownerId: 'user_1', prefs: { callSpace: 'room-1', mapSize: 'short' } }),
    );
    localStorage.setItem(UNSYNCED, 'user_1');
    get.mockResolvedValue({ mapSize: 'medium' });
    expect(await store.fetch('user_1')).toEqual({ mapSize: 'tall' });
    await flushAsync();
    expect(put).toHaveBeenCalledWith('user_1', { mapSize: 'tall' });
    expect(localStorage.getItem(UNSYNCED)).toBeNull();
  });

  it('keeps a change made before anyone was known, a key only this device changed', async () => {
    localStorage.setItem(SERVER, JSON.stringify({ ownerId: 'guest_1', prefs: { a: 1 } }));
    localStorage.setItem(KEY, JSON.stringify({ a: 1 }));
    store.write({ a: 1, reduceMotion: true });
    get.mockResolvedValue({ a: 1 });
    expect(await store.fetch('guest_1')).toEqual({ a: 1, reduceMotion: true });
  });

  it('keeps keys only this device holds when nothing is agreed yet, the server winning where both hold one', async () => {
    // A device from before the copy agreed was kept, or set up by a script: nothing tells an added key from one the
    // server dropped, so none is dropped.
    localStorage.setItem(KEY, JSON.stringify({ tourSeen: true, a: 1 }));
    get.mockResolvedValue({ a: 2 });
    expect(await store.fetch('user_1')).toEqual({ tourSeen: true, a: 2 });
    expect(agreed()).toEqual({ ownerId: 'user_1', prefs: { a: 2 } });
    // The next load keeps it too: the server never held it.
    store.reset();
    get.mockResolvedValue({ a: 2 });
    expect(await store.fetch('user_1')).toEqual({ tourSeen: true, a: 2 });
  });

  it("treats another owner's copy agreed as none", async () => {
    localStorage.setItem(KEY, JSON.stringify({ telemetryEnabled: false, a: 1 }));
    localStorage.setItem(
      SERVER,
      JSON.stringify({ ownerId: 'user_1', prefs: { telemetryEnabled: false, a: 1 } }),
    );
    get.mockResolvedValue({ a: 2 });
    expect(await store.fetch('guest_1')).toEqual({ telemetryEnabled: false, a: 2 });
    expect(agreed()).toEqual({ ownerId: 'guest_1', prefs: { a: 2 } });
  });

  it('ignores a malformed copy agreed', async () => {
    localStorage.setItem(KEY, JSON.stringify({ kept: true }));
    localStorage.setItem(SERVER, '{nope');
    get.mockResolvedValue({});
    expect(await store.fetch('user_1')).toEqual({ kept: true });
    localStorage.setItem(SERVER, JSON.stringify({ ownerId: 7, prefs: { kept: true } }));
    store.reset();
    expect(await store.fetch('user_1')).toEqual({ kept: true });
  });

  it('upgrades the server copy and nulls its retired keys on the next save', async () => {
    get.mockResolvedValue({ oldName: 1, retired: true });
    expect(await store.fetch('user_1')).toEqual({ newName: 1 });
    store.write({ newName: 2 }, 'user_1');
    await flushAsync();
    expect(put).toHaveBeenCalledWith('user_1', { newName: 2, oldName: null, retired: null });
  });

  it('fires the change event and follows the cookie on load, but sends nothing from a frame', async () => {
    const heard = vi.fn();
    window.addEventListener(EVENT, heard);
    get.mockResolvedValue({ autoOpenExplorer: true });
    await store.fetch('user_1');
    window.removeEventListener(EVENT, heard);
    expect(heard).toHaveBeenCalledTimes(1);
    expect(document.cookie).toContain('lw_open_explorer=1');

    store.reset();
    confined = true;
    localStorage.setItem(UNSYNCED, 'user_1');
    get.mockResolvedValue({ a: 1 });
    await store.fetch('user_1');
    await flushAsync();
    expect(put).not.toHaveBeenCalled();
  });

  it('records the server copy given to it as the next patch base', async () => {
    store.rememberServer('user_1', { a: 1, gone: true });
    store.save('user_1', { a: 1 });
    await flushAsync();
    expect(put).toHaveBeenCalledWith('user_1', { gone: null });
  });
});
