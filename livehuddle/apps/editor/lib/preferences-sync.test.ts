// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./api-client', () => ({
  apiGetPreferences: vi.fn(),
  apiPutPreferences: vi.fn(),
  PREFERENCES_LOCAL_ONLY: 'local-only',
}));

import { apiGetPreferences, apiPutPreferences } from './api-client';
import {
  __resetPreferencesSync,
  fitPreferences,
  preferencesLocalOnly,
  preferencesPatch,
  PREFERENCES_BODY_MAX,
  PREFERENCES_UNSYNCED_KEY,
  preferencesBodyLength,
  savePreferences,
} from './preferences-sync';
import {
  __resetFetchedPreferences,
  fetchUserPreferences,
  rebaseUserPreferences,
  STORAGE_KEY,
  writeUserPreferences,
  type UserPreferences,
} from './user-preferences';
import type { ShapePicks } from './whiteboard-shape-slots';

// Saving preferences to the server (docs/specs/007-editor/user-preferences.md "Saving to the server").

const mockedGet = vi.mocked(apiGetPreferences);
const mockedPut = vi.mocked(apiPutPreferences);

const uuid = (i: number) => `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`;

// A full account, as measured: 60 hidden documents (an old blob's list, kept on the server from before Hide from
// Recent was the index's), a busy shape history and the usual flags came to 4,967 characters, past the api's cap,
// after which every save was refused.
const RECENT_EXCLUDED_LIMIT = 60;
function fullAccount(): UserPreferences {
  const kinds = [
    'rectangle',
    'ellipse',
    'diamond',
    'triangle',
    'hexagon',
    'star',
    'arrow',
    'line',
    'cloud',
    'cylinder',
    'parallelogram',
    'trapezoid',
    'pentagon',
    'octagon',
    'cross',
    'heart',
  ];
  const picks = Object.fromEntries(
    kinds.map((k, i) => [k, [i + 1, 1_760_000_000_000 + i * 1000]]),
  ) as ShapePicks;
  return {
    ...({
      recentExcludedIds: Array.from({ length: RECENT_EXCLUDED_LIMIT }, (_, i) => uuid(i)),
    } as UserPreferences),
    whiteboardShapePicks: picks,
    whiteboardPinnedShapes: ['arrow', 'rectangle'],
    quickSwatchOverrides: { brand: { fill: ['#112233', null, '#445566'] } } as never,
    powerUserBaseline: {
      showMinimap: { before: { showMinimap: true }, applied: { showMinimap: false } },
      notificationsEnabled: { before: {}, applied: { notificationsEnabled: false } },
    },
    // Stored by older clients and kept (docs/specs/004-interface-design/colour-picker.md).
    customSwatches: Array.from({ length: 100 }, (_, i) => `#${String(i).padStart(6, '0')}`),
    whiteboardYourColours: Array.from({ length: 50 }, (_, i) => `#${String(i).padStart(6, 'a')}`),
    telemetryEnabled: false,
    tourSeen: true,
    workshopTourSeen: true,
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
  __resetFetchedPreferences();
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'info').mockImplementation(() => {});
});
afterEach(() => {
  window.localStorage.clear();
  vi.restoreAllMocks();
});

describe('fitPreferences', () => {
  it('leaves a blob that fits as it is', () => {
    const prefs = { tourSeen: true };
    expect(fitPreferences(prefs)).toBe(prefs);
  });

  it('drops an old hidden-from-Recent list, then the oldest shape picks, until it fits', () => {
    const full = fullAccount();
    // Pad the rest so the hidden list alone cannot make room.
    const prefs = { ...full, customSwatches: Array.from({ length: 280 }, () => '#abcdef') };
    expect(preferencesBodyLength(prefs)).toBeGreaterThan(PREFERENCES_BODY_MAX);
    const fitted = fitPreferences(prefs);
    expect(preferencesBodyLength(fitted)).toBeLessThanOrEqual(PREFERENCES_BODY_MAX);
    expect('recentExcludedIds' in fitted).toBe(false);
    // The newest picks stay: what went was the least recently used.
    const left = Object.values(fitted.whiteboardShapePicks ?? {}).map((p) => p![1]);
    const all = Object.values(full.whiteboardShapePicks ?? {}).map((p) => p![1]);
    expect(left.length).toBeLessThan(all.length);
    expect(Math.min(...left)).toBeGreaterThan(Math.max(...all.filter((t) => !left.includes(t))));
    expect(fitted.customSwatches).toHaveLength(280);
  });

  it('fits the measured full account by dropping only its old hidden-from-Recent list', () => {
    const prefs = fullAccount();
    // Within a few characters of the 4,967 measured.
    expect(preferencesBodyLength(prefs)).toBeGreaterThan(4900);
    const fitted = fitPreferences(prefs);
    expect(preferencesBodyLength(fitted)).toBeLessThanOrEqual(PREFERENCES_BODY_MAX);
    expect('recentExcludedIds' in fitted).toBe(false);
    expect(fitted.whiteboardShapePicks).toEqual(prefs.whiteboardShapePicks);
  });

  it('stays fast on the largest blob it can be handed', () => {
    const prefs = {
      ...fullAccount(),
      customSwatches: Array.from({ length: 280 }, () => '#abcdef'),
    };
    const start = performance.now();
    for (let i = 0; i < 20; i++) fitPreferences(prefs);
    // Measured ~0.06 ms; a trim that re-serialised per dropped entry took ~6 ms. Generous for CI.
    expect((performance.now() - start) / 20).toBeLessThan(3);
  });
});

describe('writeUserPreferences sends a blob that fits', () => {
  it('writes the trimmed blob to the cache and the server alike', () => {
    mockedPut.mockResolvedValue(true);
    writeUserPreferences(fullAccount(), 'owner-1');
    const cached = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '{}') as UserPreferences;
    expect(preferencesBodyLength(cached)).toBeLessThanOrEqual(PREFERENCES_BODY_MAX);
    expect(mockedPut.mock.calls[0]![1]).toEqual(cached);
  });
});

describe('savePreferences', () => {
  it('sends one save at a time, and only the latest of those that waited', async () => {
    let finish: (ok: boolean) => void = () => {};
    mockedPut.mockImplementationOnce(
      () =>
        new Promise<boolean>((resolve) => {
          finish = resolve;
        }),
    );
    mockedPut.mockResolvedValue(true);
    savePreferences('owner-1', { uiScale: 1 });
    savePreferences('owner-1', { uiScale: 1.05 });
    savePreferences('owner-1', { uiScale: 1.1 });
    expect(mockedPut).toHaveBeenCalledTimes(1);
    finish(true);
    await vi.waitFor(() => expect(mockedPut).toHaveBeenCalledTimes(2));
    expect(mockedPut.mock.calls[1]![1]).toEqual({ uiScale: 1.1 });
    await vi.waitFor(() =>
      expect(window.localStorage.getItem(PREFERENCES_UNSYNCED_KEY)).toBeNull(),
    );
  });

  it('keeps the device copy marked when a save is refused', async () => {
    mockedPut.mockResolvedValue(false);
    savePreferences('owner-1', { uiScale: 1.2 });
    await vi.waitFor(() => expect(mockedPut).toHaveBeenCalledTimes(1));
    await Promise.resolve();
    expect(window.localStorage.getItem(PREFERENCES_UNSYNCED_KEY)).toBe('owner-1');
  });
});

describe('fetchUserPreferences after a save that did not land', () => {
  it('keeps the device copy over the server and sends it again', async () => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ showMinimap: false, uiScale: 1.2 }));
    window.localStorage.setItem(PREFERENCES_UNSYNCED_KEY, 'owner-1');
    mockedGet.mockResolvedValue({ showMinimap: true, uiScale: 1, tourSeen: true });
    mockedPut.mockResolvedValue(true);
    const merged = await fetchUserPreferences('owner-1');
    expect(merged).toEqual({ showMinimap: false, uiScale: 1.2, tourSeen: true });
    // Only what differs from the server's copy goes.
    expect(mockedPut).toHaveBeenCalledWith('owner-1', { showMinimap: false, uiScale: 1.2 });
  });

  it("lets the server win when the mark is another owner's", async () => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ showMinimap: false }));
    window.localStorage.setItem(PREFERENCES_UNSYNCED_KEY, 'someone-else');
    mockedGet.mockResolvedValue({ showMinimap: true });
    expect(await fetchUserPreferences('owner-1')).toEqual({ showMinimap: true });
    expect(mockedPut).not.toHaveBeenCalled();
  });
});

describe('only what changed goes to the server', () => {
  it('builds a patch: changed keys whole, null for a dropped key, nothing for the same', () => {
    const base = { a: 1, picks: { x: [1, 2] }, gone: true, same: 'x' };
    const next = { a: 2, picks: { x: [1, 3] }, same: 'x', added: false };
    expect(preferencesPatch(base, next)).toEqual({
      a: 2,
      picks: { x: [1, 3] },
      gone: null,
      added: false,
    });
  });

  it('sends a change against the server copy, never undoing a key another app changed', async () => {
    mockedGet.mockResolvedValue({ reduceMotion: true, uiScale: 1 });
    mockedPut.mockResolvedValue(true);
    await fetchUserPreferences('owner-1');
    // Another app turns reduce motion off now; this tab still holds `true` and changes uiScale.
    savePreferences('owner-1', { reduceMotion: true, uiScale: 1.2 });
    await vi.waitFor(() => expect(mockedPut).toHaveBeenCalledTimes(1));
    expect(mockedPut).toHaveBeenCalledWith('owner-1', { uiScale: 1.2 });
    // The next change builds on what that save confirmed.
    savePreferences('owner-1', { reduceMotion: true });
    await vi.waitFor(() => expect(mockedPut).toHaveBeenCalledTimes(2));
    expect(mockedPut.mock.calls[1]).toEqual(['owner-1', { uiScale: null }]);
    // Nothing changed: nothing sent, and the device copy counts as synced.
    savePreferences('owner-1', { reduceMotion: true });
    await vi.waitFor(() =>
      expect(window.localStorage.getItem(PREFERENCES_UNSYNCED_KEY)).toBeNull(),
    );
    expect(mockedPut).toHaveBeenCalledTimes(2);
  });

  it('reads the server once per page load, however many surfaces ask', async () => {
    mockedGet.mockResolvedValue({ uiScale: 1 });
    await fetchUserPreferences('owner-1');
    await fetchUserPreferences('owner-1');
    expect(mockedGet).toHaveBeenCalledTimes(1);
  });

  it('asks again on the next load when the read failed', async () => {
    mockedGet.mockResolvedValueOnce(null).mockResolvedValueOnce({ uiScale: 1 });
    expect(await fetchUserPreferences('owner-1')).toBeNull();
    expect(await fetchUserPreferences('owner-1')).toEqual({ uiScale: 1 });
  });
});

describe('a deployment that keeps no preferences (guest-only deployment)', () => {
  it('keeps them in this browser alone when the api answers prefs: null', async () => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ uiScale: 1.2 }));
    window.localStorage.setItem(PREFERENCES_UNSYNCED_KEY, 'owner-1');
    mockedGet.mockResolvedValue('local-only');
    expect(await fetchUserPreferences('owner-1')).toBeNull();
    expect(preferencesLocalOnly('owner-1')).toBe(true);
    expect(window.localStorage.getItem(PREFERENCES_UNSYNCED_KEY)).toBeNull();
    writeUserPreferences({ uiScale: 1.3 }, 'owner-1');
    expect(mockedPut).not.toHaveBeenCalled();
    expect(window.localStorage.getItem(PREFERENCES_UNSYNCED_KEY)).toBeNull();
    expect(JSON.parse(window.localStorage.getItem(STORAGE_KEY)!)).toEqual({ uiScale: 1.3 });
  });

  it('stops sending once a save answers that nothing is kept', async () => {
    mockedPut.mockResolvedValue('local-only');
    savePreferences('owner-1', { uiScale: 1 });
    await vi.waitFor(() => expect(preferencesLocalOnly('owner-1')).toBe(true));
    savePreferences('owner-1', { uiScale: 2 });
    expect(mockedPut).toHaveBeenCalledTimes(1);
    expect(window.localStorage.getItem(PREFERENCES_UNSYNCED_KEY)).toBeNull();
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
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ uiScale: 1.1, tourSeen: true }));
    const { uiScale: _gone, ...rest } = { uiScale: 1.1, tourSeen: true };
    expect(rebaseUserPreferences({ uiScale: 1.1, tourSeen: true }, rest)).toEqual({
      tourSeen: true,
    });
  });

  it('builds on the snapshot when there is no cache yet', () => {
    expect(rebaseUserPreferences({ uiScale: 1 }, { uiScale: 1, tourSeen: true })).toEqual({
      uiScale: 1,
      tourSeen: true,
    });
  });
});
