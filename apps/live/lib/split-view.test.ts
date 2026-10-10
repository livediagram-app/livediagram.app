// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import {
  SPLIT_DEFAULT_FRACTION,
  SPLIT_DROP_ZONE_MIN_PX,
  SPLIT_MIN_PANE_PX,
  SPLIT_MIN_VIEWPORT_HEIGHT_PX,
  SPLIT_MIN_VIEWPORT_PX,
  SPLIT_TAB_BAR_CLEARANCE_PX,
  approachProgress,
  clampRightWidth,
  companionTabId,
  dropZoneWidth,
  fractionFor,
  inDropZone,
  pairAfterActivation,
  placeOpening,
  readStoredFraction,
  readStoredPair,
  restoredPair,
  rightWidthFor,
  splitAvailable,
  writeStoredFraction,
  writeStoredPair,
} from './split-view';

// docs/specs/007-editor/split-view.md
describe('split view rules', () => {
  afterEach(() => window.localStorage.clear());

  it('is offered only where both panes can hold the editor', () => {
    expect(SPLIT_MIN_VIEWPORT_PX).toBeGreaterThanOrEqual(SPLIT_MIN_PANE_PX * 2);
    expect(splitAvailable(SPLIT_MIN_VIEWPORT_PX, SPLIT_MIN_VIEWPORT_HEIGHT_PX)).toBe(true);
    expect(splitAvailable(SPLIT_MIN_VIEWPORT_PX - 1, 900)).toBe(false);
    expect(splitAvailable(1600, SPLIT_MIN_VIEWPORT_HEIGHT_PX - 1)).toBe(false);
  });

  it('leaves small laptop screens with one tab at a time', () => {
    // Inner window sizes: a laptop screen less the browser's toolbars.
    expect(splitAvailable(1280, 700)).toBe(false);
    expect(splitAvailable(1366, 650)).toBe(false);
    expect(splitAvailable(1440, 780)).toBe(true);
    expect(splitAvailable(1470, 830)).toBe(true);
    // A wide but short window (a laptop with the dock and bookmarks bar showing) is cramped too.
    expect(splitAvailable(1600, 680)).toBe(false);
  });

  it('holds the right pane between both minimums', () => {
    expect(clampRightWidth(10, 1440)).toBe(SPLIT_MIN_PANE_PX);
    expect(clampRightWidth(5000, 1440)).toBe(1440 - SPLIT_MIN_PANE_PX);
    expect(clampRightWidth(700, 1440)).toBe(700);
    expect(rightWidthFor(SPLIT_DEFAULT_FRACTION, 1440)).toBe(720);
  });

  it('round-trips a width through its fraction', () => {
    expect(fractionFor(720, 1440)).toBe(0.5);
    expect(fractionFor(100, 0)).toBe(SPLIT_DEFAULT_FRACTION);
  });

  it('arms the right-edge band above the tab bar, or the open right pane', () => {
    const vp = { width: 1440, height: 900 };
    const band = dropZoneWidth(1440, null);
    expect(band).toBeGreaterThanOrEqual(SPLIT_DROP_ZONE_MIN_PX);
    expect(inDropZone({ x: 1440 - band, y: 400 }, vp, null)).toBe(true);
    expect(inDropZone({ x: 1440 - band - 1, y: 400 }, vp, null)).toBe(false);
    // The tab bar's band is a reorder, never a split.
    expect(inDropZone({ x: 1430, y: 900 - SPLIT_TAB_BAR_CLEARANCE_PX + 1 }, vp, null)).toBe(false);
    // With a split open the zone is the right pane.
    expect(dropZoneWidth(1440, 600)).toBe(600);
    expect(inDropZone({ x: 1440 - 600, y: 400 }, vp, 600)).toBe(true);
    // Too narrow a screen offers nothing.
    expect(inDropZone({ x: 1000, y: 100 }, { width: 1000, height: 900 }, null)).toBe(false);
  });

  it('brightens the hint as the pointer nears the edge', () => {
    expect(approachProgress(0, 1440, null)).toBe(0);
    expect(approachProgress(1440, 1440, null)).toBe(1);
    const mid = approachProgress(1300, 1440, null);
    expect(mid).toBeGreaterThan(0);
    expect(mid).toBeLessThan(1);
  });

  it('opens a dragged tab on the right of the active one', () => {
    expect(placeOpening(['a', 'b', 'c'], 'a', 'c', null, null)).toEqual({
      leftId: 'a',
      rightId: 'c',
    });
  });

  it('sends the active tab right with its companion on the left', () => {
    // The tab you were on before wins...
    expect(placeOpening(['a', 'b', 'c'], 'b', 'b', 'c', null)).toEqual({
      leftId: 'c',
      rightId: 'b',
    });
    // ...else the left neighbour, else the right one.
    expect(companionTabId(['a', 'b', 'c'], 'b', null)).toBe('a');
    expect(companionTabId(['a', 'b', 'c'], 'a', null)).toBe('b');
    expect(companionTabId(['a', 'b'], 'a', 'gone')).toBe('b');
    // A lone tab has nothing to pair with.
    expect(placeOpening(['a'], 'a', 'a', null, null)).toBeNull();
    expect(placeOpening(['a'], 'a', 'missing', null, null)).toBeNull();
  });

  it('replaces the right tab, trades sides, or does nothing with a split open', () => {
    const pair = { leftId: 'a', rightId: 'b' };
    expect(placeOpening(['a', 'b', 'c'], 'a', 'c', null, pair)).toEqual({
      leftId: 'a',
      rightId: 'c',
    });
    expect(placeOpening(['a', 'b', 'c'], 'a', 'a', null, pair)).toEqual({
      leftId: 'b',
      rightId: 'a',
    });
    expect(placeOpening(['a', 'b', 'c'], 'a', 'b', null, pair)).toBeNull();
  });

  it('keeps both tabs on their sides as the editor moves between them', () => {
    const pair = { leftId: 'a', rightId: 'b' };
    expect(pairAfterActivation(pair, 'a', 'b')).toBe(pair);
    expect(pairAfterActivation(pair, 'b', 'a')).toBe(pair);
  });

  it('opens a third tab in the pane the editor was in', () => {
    const pair = { leftId: 'a', rightId: 'b' };
    expect(pairAfterActivation(pair, 'a', 'c')).toEqual({ leftId: 'c', rightId: 'b' });
    expect(pairAfterActivation(pair, 'b', 'c')).toEqual({ leftId: 'a', rightId: 'c' });
  });

  it('reopens the pair on its sides, whichever of its tabs the page lands on', () => {
    const pair = { leftId: 'a', rightId: 'b' };
    expect(restoredPair(pair, 'a', ['a', 'b', 'c'])).toEqual(pair);
    expect(restoredPair(pair, 'b', ['a', 'b', 'c'])).toEqual(pair);
    // Landing on a third tab puts it on the left.
    expect(restoredPair(pair, 'c', ['a', 'b', 'c'])).toEqual({ leftId: 'c', rightId: 'b' });
    // A deleted tab ends the split, and a pair never holds one tab twice.
    expect(restoredPair(pair, 'b', ['b', 'c'])).toBeNull();
    expect(restoredPair({ leftId: 'c', rightId: 'b' }, 'b', ['b'])).toBeNull();
    expect(restoredPair(null, 'a', ['a'])).toBeNull();
  });

  it('remembers the pair per document and the width once', () => {
    expect(readStoredPair('doc')).toBeNull();
    writeStoredPair('doc', { leftId: 'a', rightId: 'b' });
    expect(readStoredPair('doc')).toEqual({ leftId: 'a', rightId: 'b' });
    writeStoredPair('doc', null);
    expect(readStoredPair('doc')).toBeNull();
    window.localStorage.setItem('livediagram:v2:split-view-pair:doc', '{broken');
    expect(readStoredPair('doc')).toBeNull();

    expect(readStoredFraction()).toBe(SPLIT_DEFAULT_FRACTION);
    writeStoredFraction(0.37);
    expect(readStoredFraction()).toBe(0.37);
    window.localStorage.setItem('livediagram:v2:split-view-fraction', 'nonsense');
    expect(readStoredFraction()).toBe(SPLIT_DEFAULT_FRACTION);
  });
});
