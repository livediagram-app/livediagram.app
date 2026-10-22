import { describe, expect, it, vi } from 'vitest';
import {
  boxOnScreen,
  fitClearOfPanel,
  MAP_CLEARANCE_PX,
  notifyMapShown,
  onMapShown,
  type FitInsets,
  type ScreenBox,
} from './fit-clear-of-panel';
import { besideSideInsets, computeFitToScreen } from './viewport';

// docs/specs/008-canvas/minimap.md "Fit leaves the Map clear".

const size = { width: 1440, height: 790 };
const padding = 64;
const NONE: FitInsets = { left: 0, right: 0, top: 0, bottom: 0 };
// The Map at its home, the bottom-left corner: 256 wide, about 180 tall, 16 px in.
const map: ScreenBox = { left: 16, right: 272, top: 594, bottom: 774 };

const fitIn = (bbox: { x: number; y: number; width: number; height: number }) => (ins: FitInsets) =>
  besideSideInsets(
    computeFitToScreen(
      { width: size.width - ins.left - ins.right, height: size.height - ins.top - ins.bottom },
      bbox,
      undefined,
      padding,
    ),
    ins,
  );

const clear = (a: ScreenBox, b: ScreenBox) =>
  a.right <= b.left || a.left >= b.right || a.bottom <= b.top || a.top >= b.bottom;

describe('a fit clear of the Map', () => {
  it('leaves a fit alone when the content stays clear of the Map', () => {
    const bbox = { x: 600, y: 300, width: 300, height: 200 };
    const plain = fitIn(bbox)(NONE);
    expect(fitClearOfPanel(size, bbox, map, NONE, padding, fitIn(bbox))).toEqual(plain);
    expect(fitClearOfPanel(size, bbox, null, NONE, padding, fitIn(bbox))).toEqual(plain);
  });

  it('moves a wide board beside the Map, so no part of it lands under the Map', () => {
    const bbox = { x: 0, y: 0, width: 2200, height: 1200 };
    const plain = fitIn(bbox)(NONE);
    expect(clear(boxOnScreen(plain, size, bbox), map)).toBe(false);
    const fit = fitClearOfPanel(size, bbox, map, NONE, padding, fitIn(bbox));
    const onScreen = boxOnScreen(fit, size, bbox);
    expect(clear(onScreen, map)).toBe(true);
    expect(onScreen.left).toBeGreaterThanOrEqual(map.right + MAP_CLEARANCE_PX - 0.5);
    expect(onScreen.right).toBeLessThanOrEqual(size.width - padding + 0.5);
  });

  it('moves a tall board above the Map when that keeps it larger', () => {
    const bbox = { x: 0, y: 0, width: 1800, height: 300 };
    const fit = fitClearOfPanel(size, bbox, map, NONE, padding, fitIn(bbox));
    const onScreen = boxOnScreen(fit, size, bbox);
    expect(clear(onScreen, map)).toBe(true);
    expect(onScreen.bottom).toBeLessThanOrEqual(map.top - MAP_CLEARANCE_PX + 0.5);
    // Above it, the board keeps the canvas's whole width.
    expect(fit.zoom).toBeCloseTo((size.width - 2 * padding) / bbox.width, 5);
  });

  it('keeps clear of a Map docked in the top-right corner too', () => {
    const topRight: ScreenBox = { left: 1168, right: 1424, top: 80, bottom: 260 };
    const bbox = { x: 0, y: 0, width: 2400, height: 1400 };
    const fit = fitClearOfPanel(size, bbox, topRight, NONE, padding, fitIn(bbox));
    expect(clear(boxOnScreen(fit, size, bbox), topRight)).toBe(true);
  });

  it('shifts a frame down and up by its top and bottom insets as it does across', () => {
    const frame = { zoom: 0.5, offset: { x: 0, y: 0 } };
    expect(besideSideInsets(frame, { left: 0, right: 0, bottom: 200 }).offset).toEqual({
      x: 0,
      y: 100 - 200,
    });
    expect(besideSideInsets(frame, { left: 0, right: 0 })).toBe(frame);
  });
});

describe('the Map showing up', () => {
  it('tells whoever listens, until they stop', () => {
    const heard = vi.fn();
    const stop = onMapShown(heard);
    notifyMapShown();
    expect(heard).toHaveBeenCalledTimes(1);
    stop();
    notifyMapShown();
    expect(heard).toHaveBeenCalledTimes(1);
  });
});
