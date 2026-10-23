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
  markPreferencesSynced,
  PREFERENCES_BODY_MAX,
  PREFERENCES_SAVE_DEBOUNCE_MS,
  PREFERENCES_UNSYNCED_KEY,
  preferencesBodyLength,
  preferencesPatch,
  preferencesStoredOnServer,
  savePreferences,
} from './preferences-sync';
import {
  __forgetFetchedPreferences,
  fetchUserPreferences,
  RECENT_EXCLUDED_LIMIT,
  rebaseUserPreferences,
  STORAGE_KEY,
  writeUserPreferences,
  type UserPreferences,
} from './user-preferences';

// Saving preferences to the server (docs/specs/007-editor/user-preferences.md "Saving to the server").

const mockedGet = vi.mocked(apiGetPreferences);
const mockedPut = vi.mocked(apiPutPreferences);

const uuid = (i: number) => `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`;

// A full account: 60 hidden designs and the usual flags, past the api's cap, after which every
// save was refused.
function fullAccount(): UserPreferences {
  return {
    recentExcludedIds: Array.from({ length: RECENT_EXCLUDED_LIMIT }, (_, i) => uuid(i)),
    quickSwatchOverrides: { brand: { fill: ['#112233', null, '#445566'] } } as never,
    logoGuidesHidden: ['centre', 'keylines', 'safe', 'grid'],
    powerUserBaseline: {
      showMinimap: { before: { showMinimap: true }, applied: { showMinimap: false } },
      notificationsEnabled: { before: {}, applied: { notificationsEnabled: false } },
    },
    // Stored by older clients and kept (docs/specs/004-interface-design/colour-picker.md).
    customSwatches: Array.from({ length: 220 }, (_, i) => `#${String(i).padStart(6, '0')}`),
    telemetryEnabled: false,
    alignmentGuides: true,
    uiScale: 1.1,
    panelOpacity: 0.85,
    elementIndicatorStyle: 'footer',
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
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'info').mockImplementation(() => {});
});
afterEach(() => {
  vi.useRealTimers();
  window.localStorage.clear();
  vi.restoreAllMocks();
});

describe('fitPreferences', () => {
  it('leaves a blob that fits as it is', () => {
    const prefs = { alignmentGuides: true };
    expect(fitPreferences(prefs)).toBe(prefs);
  });

  it('keeps every other key whole when the hidden ids cannot make room', () => {
    const full = fullAccount();
    // Pad the rest so the hidden list alone cannot make room.
    const prefs = { ...full, customSwatches: Array.from({ length: 400 }, () => '#abcdef') };
    expect(preferencesBodyLength(prefs)).toBeGreaterThan(PREFERENCES_BODY_MAX);
    const fitted = fitPreferences(prefs);
    expect(fitted.recentExcludedIds).toEqual([]);
    expect(fitted.customSwatches).toHaveLength(400);
  });

  it('fits a full account by dropping only its oldest hidden ids', () => {
    const prefs = fullAccount();
    expect(preferencesBodyLength(prefs)).toBeGreaterThan(PREFERENCES_BODY_MAX);
    const fitted = fitPreferences(prefs);
    expect(preferencesBodyLength(fitted)).toBeLessThanOrEqual(PREFERENCES_BODY_MAX);
    const kept = fitted.recentExcludedIds ?? [];
    expect(kept.length).toBeGreaterThan(0);
    expect(kept).toEqual(prefs.recentExcludedIds!.slice(0, kept.length));
  });

  it('stays fast on the largest blob it can be handed', () => {
    const prefs = {
      ...fullAccount(),
      customSwatches: Array.from({ length: 400 }, () => '#abcdef'),
    };
    const start = performance.now();
    for (let i = 0; i < 20; i++) fitPreferences(prefs);
    // Measured ~0.06 ms; a trim that re-serialised per dropped entry took ~6 ms. Generous for CI.
    expect((performance.now() - start) / 20).toBeLessThan(3);
  });
});

describe('writeUserPreferences sends a blob that fits', () => {
  it('writes the trimmed blob to the cache and the server alike', async () => {
    vi.useFakeTimers();
    mockedPut.mockResolvedValue('saved');
    writeUserPreferences(fullAccount(), 'owner-1');
    const cached = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '{}') as UserPreferences;
    expect(preferencesBodyLength(cached)).toBeLessThanOrEqual(PREFERENCES_BODY_MAX);
    await vi.advanceTimersByTimeAsync(PREFERENCES_SAVE_DEBOUNCE_MS);
    // Nothing fetched yet, so every key goes.
    expect(mockedPut.mock.calls[0]![1]).toEqual(cached);
  });
});

describe('preferencesPatch', () => {
  it('sends each changed key whole, null for a removed one, and nothing unchanged', () => {
    const base: UserPreferences = {
      uiScale: 1,
      presentation: { slideTransition: 'fade', autoAdvanceSeconds: 5 },
      reduceMotion: true,
    };
    const next: UserPreferences = {
      uiScale: 1,
      presentation: { slideTransition: 'none', autoAdvanceSeconds: 5 },
    };
    expect(preferencesPatch(base, next)).toEqual({
      presentation: { slideTransition: 'none', autoAdvanceSeconds: 5 },
      reduceMotion: null,
    });
    expect(preferencesPatch(base, base)).toEqual({});
  });
});

describe('savePreferences', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('turns a run of changes into one request, after the pause', async () => {
    mockedPut.mockResolvedValue('saved');
    markPreferencesSynced('owner-1', { uiScale: 1, alignmentGuides: true });
    // A slider dragged across 20 steps, 50 ms apart.
    for (let i = 1; i <= 20; i++) {
      savePreferences('owner-1', { uiScale: 1 + i / 100, alignmentGuides: true });
      await vi.advanceTimersByTimeAsync(50);
    }
    expect(mockedPut).not.toHaveBeenCalled();
    expect(window.localStorage.getItem(PREFERENCES_UNSYNCED_KEY)).toBe('owner-1');
    await vi.advanceTimersByTimeAsync(PREFERENCES_SAVE_DEBOUNCE_MS);
    expect(mockedPut).toHaveBeenCalledTimes(1);
    expect(mockedPut).toHaveBeenCalledWith('owner-1', { uiScale: 1.2 });
    expect(window.localStorage.getItem(PREFERENCES_UNSYNCED_KEY)).toBeNull();
  });

  it('sends one save at a time, and only what the latest changed since the last', async () => {
    let finish: (r: 'saved') => void = () => {};
    mockedPut.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    mockedPut.mockResolvedValue('saved');
    markPreferencesSynced('owner-1', { uiScale: 1 });
    savePreferences('owner-1', { uiScale: 1.05 });
    await vi.advanceTimersByTimeAsync(PREFERENCES_SAVE_DEBOUNCE_MS);
    savePreferences('owner-1', { uiScale: 1.05, reduceMotion: true });
    await vi.advanceTimersByTimeAsync(PREFERENCES_SAVE_DEBOUNCE_MS);
    expect(mockedPut).toHaveBeenCalledTimes(1);
    finish('saved');
    await vi.waitFor(() => expect(mockedPut).toHaveBeenCalledTimes(2));
    expect(mockedPut.mock.calls[1]![1]).toEqual({ reduceMotion: true });
  });

  it('sends a waiting change at once when the page goes away', async () => {
    mockedPut.mockResolvedValue('saved');
    savePreferences('owner-1', { uiScale: 1.1 });
    window.dispatchEvent(new Event('pagehide'));
    await Promise.resolve();
    expect(mockedPut).toHaveBeenCalledTimes(1);
    flushPreferences();
    expect(mockedPut).toHaveBeenCalledTimes(1);
  });

  it('keeps the device copy marked when a save is refused', async () => {
    mockedPut.mockResolvedValue('refused');
    savePreferences('owner-1', { uiScale: 1.2 });
    await vi.advanceTimersByTimeAsync(PREFERENCES_SAVE_DEBOUNCE_MS);
    expect(mockedPut).toHaveBeenCalledTimes(1);
    expect(window.localStorage.getItem(PREFERENCES_UNSYNCED_KEY)).toBe('owner-1');
  });

  it('stops sending when the deployment keeps no preferences', async () => {
    mockedPut.mockResolvedValue('not_stored');
    savePreferences('owner-1', { uiScale: 1.2 });
    await vi.advanceTimersByTimeAsync(PREFERENCES_SAVE_DEBOUNCE_MS);
    expect(preferencesStoredOnServer()).toBe(false);
    expect(window.localStorage.getItem(PREFERENCES_UNSYNCED_KEY)).toBeNull();
    savePreferences('owner-1', { uiScale: 1.3 });
    await vi.advanceTimersByTimeAsync(PREFERENCES_SAVE_DEBOUNCE_MS);
    expect(mockedPut).toHaveBeenCalledTimes(1);
  });
});

describe('fetchUserPreferences', () => {
  beforeEach(() => __forgetFetchedPreferences());

  it('asks the server once per page load, however many ask', async () => {
    mockedGet.mockResolvedValue({ showMinimap: true });
    const [a, b] = await Promise.all([
      fetchUserPreferences('owner-1'),
      fetchUserPreferences('owner-1'),
    ]);
    await fetchUserPreferences('owner-1');
    expect(a).toEqual({ showMinimap: true });
    expect(b).toBe(a);
    expect(mockedGet).toHaveBeenCalledTimes(1);
  });

  it('asks again after a failed read', async () => {
    mockedGet.mockResolvedValueOnce(null).mockResolvedValue({ showMinimap: true });
    expect(await fetchUserPreferences('owner-1')).toBeNull();
    expect(await fetchUserPreferences('owner-1')).toEqual({ showMinimap: true });
    expect(mockedGet).toHaveBeenCalledTimes(2);
  });

  it('keeps the browser copy when the deployment keeps none', async () => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ showMinimap: false }));
    window.localStorage.setItem(PREFERENCES_UNSYNCED_KEY, 'owner-1');
    mockedGet.mockResolvedValue('not_stored');
    expect(await fetchUserPreferences('owner-1')).toBeNull();
    expect(preferencesStoredOnServer()).toBe(false);
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe('{"showMinimap":false}');
    expect(window.localStorage.getItem(PREFERENCES_UNSYNCED_KEY)).toBeNull();
  });

  it('sends a later change as a patch on what it fetched', async () => {
    vi.useFakeTimers();
    mockedGet.mockResolvedValue({ showMinimap: true, uiScale: 1 });
    mockedPut.mockResolvedValue('saved');
    const merged = await fetchUserPreferences('owner-1');
    writeUserPreferences({ ...merged!, showMinimap: false }, 'owner-1');
    await vi.advanceTimersByTimeAsync(PREFERENCES_SAVE_DEBOUNCE_MS);
    expect(mockedPut).toHaveBeenCalledWith('owner-1', { showMinimap: false });
    vi.useRealTimers();
  });
});

describe('fetchUserPreferences after a save that did not land', () => {
  beforeEach(() => __forgetFetchedPreferences());

  it('keeps the device copy over the server and sends it again', async () => {
    vi.useFakeTimers();
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ showMinimap: false, uiScale: 1.2 }));
    window.localStorage.setItem(PREFERENCES_UNSYNCED_KEY, 'owner-1');
    mockedGet.mockResolvedValue({ showMinimap: true, uiScale: 1, alignmentGuides: true });
    mockedPut.mockResolvedValue('saved');
    const merged = await fetchUserPreferences('owner-1');
    expect(merged).toEqual({ showMinimap: false, uiScale: 1.2, alignmentGuides: true });
    await vi.advanceTimersByTimeAsync(PREFERENCES_SAVE_DEBOUNCE_MS);
    // Only what differs from the server's set.
    expect(mockedPut).toHaveBeenCalledWith('owner-1', { showMinimap: false, uiScale: 1.2 });
    vi.useRealTimers();
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
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ uiScale: 1.1, alignmentGuides: true }),
    );
    const { uiScale: _gone, ...rest } = { uiScale: 1.1, alignmentGuides: true };
    expect(rebaseUserPreferences({ uiScale: 1.1, alignmentGuides: true }, rest)).toEqual({
      alignmentGuides: true,
    });
  });

  it('builds on the snapshot when there is no cache yet', () => {
    expect(rebaseUserPreferences({ uiScale: 1 }, { uiScale: 1, alignmentGuides: true })).toEqual({
      uiScale: 1,
      alignmentGuides: true,
    });
  });
});
