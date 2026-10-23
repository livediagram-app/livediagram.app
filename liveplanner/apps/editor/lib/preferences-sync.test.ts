// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./api-client', () => ({
  apiGetPreferences: vi.fn(),
  apiPutPreferences: vi.fn(),
}));

import { apiGetPreferences, apiPutPreferences } from './api-client';
import {
  __resetPreferencesSync,
  fitPreferences,
  flushPreferences,
  PREFERENCES_BODY_MAX,
  PREFERENCES_UNSYNCED_KEY,
  preferencesBodyLength,
  preferencesKeptLocally,
  preferencesPatch,
  SAVE_DEBOUNCE_MS,
  savePreferences,
  setServerPreferences,
} from './preferences-sync';
import {
  __forgetPreferenceLoads,
  fetchUserPreferences,
  rebaseUserPreferences,
  STORAGE_KEY,
  writeUserPreferences,
  type UserPreferences,
} from './user-preferences';

// Saving preferences to the server (docs/specs/007-editor/user-preferences.md "Saving to the server").

const mockedGet = vi.mocked(apiGetPreferences);
const mockedPut = vi.mocked(apiPutPreferences);

// A full account: the usual flags, with a stored list nothing reads padding it past the api's cap, after which
// every save was refused.
function fullAccount(): UserPreferences {
  return {
    quickSwatchOverrides: { brand: { fill: ['#112233', null, '#445566'] } } as never,
    powerUserBaseline: {
      showMinimap: { before: { showMinimap: true }, applied: { showMinimap: false } },
      notificationsEnabled: { before: {}, applied: { notificationsEnabled: false } },
    },
    // Stored by older clients and kept (docs/specs/004-interface-design/colour-picker.md).
    customSwatches: Array.from({ length: 400 }, (_, i) => `#${String(i).padStart(6, '0')}`),
    telemetryEnabled: false,
    planTourSeen: true,
    uiScale: 1.1,
    panelOpacity: 0.85,
    elementIndicatorStyle: 'footer',
    drawPattern: 'graph',
    reduceMotion: true,
    powerUserMode: true,
    notifyTips: false,
    notifyMilestones: false,
  };
}

beforeEach(() => {
  mockedGet.mockReset();
  mockedPut.mockReset();
  __resetPreferencesSync();
  __forgetPreferenceLoads();
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'info').mockImplementation(() => {});
});
afterEach(() => {
  window.localStorage.clear();
  vi.restoreAllMocks();
});

describe('fitPreferences', () => {
  it('leaves a blob that fits as it is', () => {
    const prefs = { planTourSeen: true };
    expect(fitPreferences(prefs)).toBe(prefs);
  });

  it('drops the keys nothing reads until it fits, keeping every choice', () => {
    const prefs = fullAccount();
    expect(preferencesBodyLength(prefs)).toBeGreaterThan(PREFERENCES_BODY_MAX);
    const fitted = fitPreferences(prefs);
    expect(preferencesBodyLength(fitted)).toBeLessThanOrEqual(PREFERENCES_BODY_MAX);
    expect(fitted.customSwatches).toBeUndefined();
    // It fitted once the colours went: the next dead key stays.
    expect(fitted.drawPattern).toBe('graph');
    expect(fitted.powerUserBaseline).toEqual(prefs.powerUserBaseline);
  });

  it('stays fast on the largest blob it can be handed', () => {
    const prefs = {
      ...fullAccount(),
      customSwatches: Array.from({ length: 1000 }, () => '#abcdef'),
    };
    const start = performance.now();
    for (let i = 0; i < 20; i++) fitPreferences(prefs);
    // One serialisation a dropped key: well under a millisecond. Generous for CI.
    expect((performance.now() - start) / 20).toBeLessThan(3);
  });
});

describe('writeUserPreferences sends a blob that fits', () => {
  it('writes the trimmed blob to the cache, and sends it whole while nothing of the server is known', async () => {
    mockedPut.mockResolvedValue('saved');
    writeUserPreferences(fullAccount(), 'owner-1');
    const cached = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '{}') as UserPreferences;
    expect(preferencesBodyLength(cached)).toBeLessThanOrEqual(PREFERENCES_BODY_MAX);
    await vi.waitFor(() => expect(mockedPut).toHaveBeenCalledTimes(1));
    expect(mockedPut.mock.calls[0]![1]).toEqual(cached);
  });
});

describe('savePreferences', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('waits for the next save, then sends one patch of what differs from the server', async () => {
    mockedPut.mockResolvedValue('saved');
    setServerPreferences('owner-1', {
      uiScale: 1,
      uiScalePanels: 0.9,
      powerUserBaseline: { chrome: { before: { uiScale: 1 }, applied: { uiScale: 1.2 } } },
    });
    savePreferences('owner-1', {
      uiScale: 1.05,
      uiScalePanels: 0.9,
      powerUserBaseline: { chrome: { before: { uiScale: 1 }, applied: { uiScale: 1.2 } } },
    });
    savePreferences('owner-1', {
      uiScale: 1.1,
      powerUserBaseline: { chrome: { before: { uiScale: 1 }, applied: { uiScale: 1.1 } } },
    });
    expect(mockedPut).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(SAVE_DEBOUNCE_MS);
    expect(mockedPut).toHaveBeenCalledTimes(1);
    // A nested value goes whole; a key that went is null; an unchanged key is not sent.
    expect(mockedPut.mock.calls[0]![1]).toEqual({
      uiScale: 1.1,
      uiScalePanels: null,
      powerUserBaseline: { chrome: { before: { uiScale: 1 }, applied: { uiScale: 1.1 } } },
    });
    expect(window.localStorage.getItem(PREFERENCES_UNSYNCED_KEY)).toBeNull();
  });

  it('sends one save at a time, the latest of those that waited, against what last landed', async () => {
    let finish: (result: 'saved') => void = () => {};
    mockedPut.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    mockedPut.mockResolvedValue('saved');
    setServerPreferences('owner-1', {});
    savePreferences('owner-1', { uiScale: 1 });
    await vi.advanceTimersByTimeAsync(SAVE_DEBOUNCE_MS);
    savePreferences('owner-1', { uiScale: 1, showMinimap: false });
    savePreferences('owner-1', { uiScale: 1, showMinimap: false, reduceMotion: true });
    await vi.advanceTimersByTimeAsync(SAVE_DEBOUNCE_MS);
    expect(mockedPut).toHaveBeenCalledTimes(1);
    finish('saved');
    await vi.waitFor(() => expect(mockedPut).toHaveBeenCalledTimes(2));
    expect(mockedPut.mock.calls[1]![1]).toEqual({ showMinimap: false, reduceMotion: true });
  });

  it('sends nothing when nothing differs', async () => {
    setServerPreferences('owner-1', { uiScale: 1 });
    savePreferences('owner-1', { uiScale: 1 });
    await vi.advanceTimersByTimeAsync(SAVE_DEBOUNCE_MS);
    expect(mockedPut).not.toHaveBeenCalled();
    expect(window.localStorage.getItem(PREFERENCES_UNSYNCED_KEY)).toBeNull();
  });

  it('keeps the device copy marked when a save fails', async () => {
    mockedPut.mockResolvedValue('failed');
    savePreferences('owner-1', { uiScale: 1.2 });
    await vi.advanceTimersByTimeAsync(SAVE_DEBOUNCE_MS);
    expect(mockedPut).toHaveBeenCalledTimes(1);
    expect(window.localStorage.getItem(PREFERENCES_UNSYNCED_KEY)).toBe('owner-1');
  });

  it('stops sending once the server says it keeps no preferences', async () => {
    mockedPut.mockResolvedValue('local');
    savePreferences('owner-1', { uiScale: 1.2 });
    await vi.advanceTimersByTimeAsync(SAVE_DEBOUNCE_MS);
    savePreferences('owner-1', { uiScale: 1.1 });
    await vi.advanceTimersByTimeAsync(SAVE_DEBOUNCE_MS);
    expect(mockedPut).toHaveBeenCalledTimes(1);
    expect(preferencesKeptLocally()).toBe(true);
    expect(window.localStorage.getItem(PREFERENCES_UNSYNCED_KEY)).toBeNull();
  });

  it('goes at once when the page is hidden', async () => {
    mockedPut.mockResolvedValue('saved');
    savePreferences('owner-1', { uiScale: 1.2 });
    flushPreferences();
    await vi.waitFor(() => expect(mockedPut).toHaveBeenCalledTimes(1));
  });
});

describe('preferencesPatch', () => {
  // The whole blob at its budget, against a server copy with every key changed: one pass, linear.
  it('measures the largest blob within budget', () => {
    const prefs = fullAccount() as Record<string, unknown>;
    const base = Object.fromEntries(Object.keys(prefs).map((key) => [key, 'old']));
    const start = performance.now();
    for (let i = 0; i < 100; i++) preferencesPatch(base, prefs);
    // Measured ~0.03 ms a patch. Generous for CI.
    expect((performance.now() - start) / 100).toBeLessThan(2);
    expect(Object.keys(preferencesPatch(base, prefs))).toHaveLength(Object.keys(prefs).length);
  });
});

describe('fetchUserPreferences', () => {
  it('reads once a page load, the Explorer and the editor sharing it', async () => {
    mockedGet.mockResolvedValue({ showMinimap: true });
    const [a, b] = await Promise.all([
      fetchUserPreferences('owner-1'),
      fetchUserPreferences('owner-1'),
    ]);
    expect(mockedGet).toHaveBeenCalledTimes(1);
    expect(a).toEqual({ showMinimap: true });
    expect(b).toEqual({ showMinimap: true });
  });

  it('keeps preferences in the browser where the server keeps none', async () => {
    mockedGet.mockResolvedValue('local');
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ showMinimap: false }));
    expect(await fetchUserPreferences('owner-1')).toBeNull();
    expect(preferencesKeptLocally()).toBe(true);
    writeUserPreferences({ showMinimap: true }, 'owner-1');
    expect(mockedPut).not.toHaveBeenCalled();
  });
});

describe('fetchUserPreferences after a save that did not land', () => {
  it('keeps the device copy over the server and sends what differs again', async () => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ showMinimap: false, uiScale: 1.2 }));
    window.localStorage.setItem(PREFERENCES_UNSYNCED_KEY, 'owner-1');
    mockedGet.mockResolvedValue({ showMinimap: true, uiScale: 1, planTourSeen: true });
    mockedPut.mockResolvedValue('saved');
    const merged = await fetchUserPreferences('owner-1');
    expect(merged).toEqual({ showMinimap: false, uiScale: 1.2, planTourSeen: true });
    await vi.waitFor(() =>
      expect(mockedPut).toHaveBeenCalledWith('owner-1', { showMinimap: false, uiScale: 1.2 }),
    );
  });

  it("lets the server win when the mark is another owner's", async () => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ showMinimap: false }));
    window.localStorage.setItem(PREFERENCES_UNSYNCED_KEY, 'someone-else');
    mockedGet.mockResolvedValue({ showMinimap: true });
    expect(await fetchUserPreferences('owner-1')).toEqual({ showMinimap: true });
    expect(mockedPut).not.toHaveBeenCalled();
  });
});

describe('rebaseUserPreferences', () => {
  it("applies only this render's change, keeping another tab's write since", () => {
    const snapshot: UserPreferences = { showMinimap: true, uiScale: 1 };
    // Another tab turned reduce motion on after this render.
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ showMinimap: true, uiScale: 1, reduceMotion: true }),
    );
    const next = rebaseUserPreferences(snapshot, { ...snapshot, showMinimap: false });
    expect(next).toEqual({ showMinimap: false, uiScale: 1, reduceMotion: true });
  });

  it('removes a key the change removed', () => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ uiScale: 1.1, planTourSeen: true }));
    const { uiScale: _gone, ...rest } = { uiScale: 1.1, planTourSeen: true };
    expect(rebaseUserPreferences({ uiScale: 1.1, planTourSeen: true }, rest)).toEqual({
      planTourSeen: true,
    });
  });

  it('builds on the snapshot when there is no cache yet', () => {
    expect(rebaseUserPreferences({ uiScale: 1 }, { uiScale: 1, planTourSeen: true })).toEqual({
      uiScale: 1,
      planTourSeen: true,
    });
  });
});
