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
  PREFERENCES_BODY_MAX,
  PREFERENCES_UNSYNCED_KEY,
  preferencesBodyLength,
  savePreferences,
} from './preferences-sync';
import {
  fetchUserPreferences,
  RECENT_EXCLUDED_LIMIT,
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

// A full account, as measured: 60 hidden documents, a busy shape history and the usual flags
// came to 4,967 characters, past the api's cap, after which every save was refused.
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
    recentExcludedIds: Array.from({ length: RECENT_EXCLUDED_LIMIT }, (_, i) => uuid(i)),
    whiteboardShapePicks: picks,
    whiteboardPinnedShapes: ['arrow', 'rectangle'],
    quickSwatchOverrides: { brand: { fill: ['#112233', null, '#445566'] } } as never,
    logoGuidesHidden: ['centre', 'keylines', 'safe', 'grid'],
    powerUserBaseline: {
      showMinimap: { before: { showMinimap: true }, applied: { showMinimap: false } },
      notificationsEnabled: { before: {}, applied: { notificationsEnabled: false } },
    },
    // Stored by older clients and kept (docs/specs/004-interface-design/colour-picker.md).
    customSwatches: Array.from({ length: 100 }, (_, i) => `#${String(i).padStart(6, '0')}`),
    whiteboardYourColours: Array.from({ length: 50 }, (_, i) => `#${String(i).padStart(6, 'a')}`),
    telemetryEnabled: false,
    tourSeen: true,
    planTourSeen: true,
    facilitateTourSeen: true,
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

  it('trims the oldest hidden ids, then the oldest shape picks, until it fits', () => {
    const full = fullAccount();
    // Pad the rest so the hidden list alone cannot make room.
    const prefs = { ...full, customSwatches: Array.from({ length: 280 }, () => '#abcdef') };
    expect(preferencesBodyLength(prefs)).toBeGreaterThan(PREFERENCES_BODY_MAX);
    const fitted = fitPreferences(prefs);
    expect(preferencesBodyLength(fitted)).toBeLessThanOrEqual(PREFERENCES_BODY_MAX);
    expect(fitted.recentExcludedIds).toEqual([]);
    // The newest picks stay: what went was the least recently used.
    const left = Object.values(fitted.whiteboardShapePicks ?? {}).map((p) => p![1]);
    const all = Object.values(full.whiteboardShapePicks ?? {}).map((p) => p![1]);
    expect(left.length).toBeLessThan(all.length);
    expect(Math.min(...left)).toBeGreaterThan(Math.max(...all.filter((t) => !left.includes(t))));
    expect(fitted.customSwatches).toHaveLength(280);
  });

  it('fits the measured full account by dropping only its oldest hidden ids', () => {
    const prefs = fullAccount();
    // Within a few characters of the 4,967 measured.
    expect(preferencesBodyLength(prefs)).toBeGreaterThan(4900);
    const fitted = fitPreferences(prefs);
    expect(preferencesBodyLength(fitted)).toBeLessThanOrEqual(PREFERENCES_BODY_MAX);
    const kept = fitted.recentExcludedIds ?? [];
    expect(kept.length).toBeGreaterThan(0);
    expect(kept).toEqual(prefs.recentExcludedIds!.slice(0, kept.length));
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
    expect(mockedPut).toHaveBeenCalledWith('owner-1', merged);
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
