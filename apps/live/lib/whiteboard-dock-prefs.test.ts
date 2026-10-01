import { describe, expect, it } from 'vitest';
import {
  WHITEBOARD_DOCK_POSITIONS,
  readWhiteboardDockPosition,
  readWhiteboardDockPrefs,
  withWhiteboardDockPosition,
  withWhiteboardDockPrefs,
} from './whiteboard-dock-prefs';
import type { UserPreferences } from './user-preferences';

describe('readWhiteboardDockPrefs', () => {
  it('starts with the default pins and no history', () => {
    expect(readWhiteboardDockPrefs({})).toEqual({ pinned: ['arrow', 'rectangle'], picks: {} });
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
  it('writes only what changed, and drops empty counts rather than storing them', () => {
    const base: UserPreferences = { reduceMotion: true, whiteboardPinnedShapes: ['star'] };
    // Once changed, the pins are stored, even empty: absent means the defaults.
    expect(withWhiteboardDockPrefs(base, { pinned: [] })).toEqual({
      reduceMotion: true,
      whiteboardPinnedShapes: [],
    });
    expect(withWhiteboardDockPrefs(base, { picks: { star: [1, 2] } })).toEqual({
      ...base,
      whiteboardShapePicks: { star: [1, 2] },
    });
    expect(
      withWhiteboardDockPrefs({ whiteboardShapePicks: { star: [1, 2] } }, { picks: {} }),
    ).toEqual({});
  });
});

// docs/specs/023-whiteboard/whiteboard.md "Where the dock sits".
describe('the dock position', () => {
  it('offers the top and the bottom, top first', () => {
    expect(WHITEBOARD_DOCK_POSITIONS).toEqual(['top', 'bottom']);
  });

  it('sits at the top unless the bottom was chosen', () => {
    expect(readWhiteboardDockPosition({})).toBe('top');
    expect(readWhiteboardDockPosition({ whiteboardDockPosition: 'top' })).toBe('top');
    expect(readWhiteboardDockPosition({ whiteboardDockPosition: 'bottom' })).toBe('bottom');
  });

  it('reads junk as the top', () => {
    for (const junk of ['left', '', 1, null, true]) {
      const prefs = { whiteboardDockPosition: junk } as unknown as UserPreferences;
      expect(readWhiteboardDockPosition(prefs)).toBe('top');
    }
  });

  it('writes only its own key', () => {
    const before: UserPreferences = { whiteboardPinnedShapes: ['line'], mapSize: 'tall' };
    expect(withWhiteboardDockPosition(before, 'bottom')).toEqual({
      ...before,
      whiteboardDockPosition: 'bottom',
    });
    expect(before).not.toHaveProperty('whiteboardDockPosition');
  });
});
