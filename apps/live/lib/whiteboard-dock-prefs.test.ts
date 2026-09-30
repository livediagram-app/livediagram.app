import { describe, expect, it } from 'vitest';
import {
  DEFAULT_WHITEBOARD_DOCK_MODE,
  readWhiteboardDockPrefs,
  withWhiteboardDockPrefs,
} from './whiteboard-dock-prefs';
import type { UserPreferences } from './user-preferences';

describe('readWhiteboardDockPrefs', () => {
  it('starts With shapes, the default pins and no history', () => {
    expect(readWhiteboardDockPrefs({})).toEqual({
      mode: DEFAULT_WHITEBOARD_DOCK_MODE,
      pinned: ['arrow', 'rectangle', 'ellipse'],
      picks: {},
    });
    expect(DEFAULT_WHITEBOARD_DOCK_MODE).toBe('shapes');
  });

  it('reads Simple, and anything unknown or not yet selectable as the default', () => {
    expect(readWhiteboardDockPrefs({ whiteboardDockMode: 'simple' }).mode).toBe('simple');
    expect(readWhiteboardDockPrefs({ whiteboardDockMode: 'full' } as never).mode).toBe('shapes');
    expect(readWhiteboardDockPrefs({ whiteboardDockMode: 7 } as never).mode).toBe('shapes');
  });

  it('keeps only catalogue kinds among the pinned, once each, at most seven', () => {
    const prefs = {
      whiteboardPinnedShapes: [
        'star',
        'banner',
        'star',
        'cloud',
        'hexagon',
        3,
        'line',
        'arrow',
        'cylinder',
        'diamond',
        'ellipse',
      ],
    } as unknown as UserPreferences;
    expect(readWhiteboardDockPrefs(prefs).pinned).toEqual([
      'star',
      'cloud',
      'hexagon',
      'line',
      'arrow',
      'cylinder',
      'diamond',
    ]);
  });

  it('keeps an emptied pinned side empty, and reads a malformed one as the defaults', () => {
    expect(readWhiteboardDockPrefs({ whiteboardPinnedShapes: [] }).pinned).toEqual([]);
    expect(readWhiteboardDockPrefs({ whiteboardPinnedShapes: 'star' } as never).pinned).toEqual([
      'arrow',
      'rectangle',
      'ellipse',
    ]);
  });

  it('keeps only well-formed counts of catalogue kinds', () => {
    const prefs = {
      whiteboardShapePicks: {
        star: [3, 100],
        banner: [9, 1],
        cloud: [-1, 1],
        hexagon: ['x', 1],
        diamond: [2.5, 1],
        triangle: [1, Number.NaN],
        rectangle: [4],
      },
    } as unknown as UserPreferences;
    expect(readWhiteboardDockPrefs(prefs).picks).toEqual({ star: [3, 100] });
    expect(readWhiteboardDockPrefs({ whiteboardShapePicks: [] } as never).picks).toEqual({});
  });
});

describe('withWhiteboardDockPrefs', () => {
  it('writes only what changed, and drops empty values rather than storing them', () => {
    const base: UserPreferences = { reduceMotion: true, whiteboardPinnedShapes: ['star'] };
    expect(withWhiteboardDockPrefs(base, { mode: 'simple' })).toEqual({
      reduceMotion: true,
      whiteboardPinnedShapes: ['star'],
      whiteboardDockMode: 'simple',
    });
    // Once changed, the pins are stored, even empty: absent means the defaults.
    expect(withWhiteboardDockPrefs(base, { pinned: [] })).toEqual({
      reduceMotion: true,
      whiteboardPinnedShapes: [],
    });
    expect(withWhiteboardDockPrefs(base, { picks: { star: [1, 2] } })).toEqual({
      ...base,
      whiteboardShapePicks: { star: [1, 2] },
    });
  });

  it('stores the default mode as no value', () => {
    expect(withWhiteboardDockPrefs({ whiteboardDockMode: 'simple' }, { mode: 'shapes' })).toEqual(
      {},
    );
  });
});
