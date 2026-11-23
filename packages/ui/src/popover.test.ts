import { describe, expect, it } from 'vitest';
import {
  OVERLAY_MAX_WIDTH,
  clampIntoRange,
  keepOnScreen,
  overlayMaxWidth,
  shiftIntoRange,
} from './popover';

// A 390 x 844 phone, the size the overlays are checked at.
const PHONE = { width: 390, height: 844 };
const box = (left: number, top: number, width: number, height: number) => ({
  left,
  top,
  right: left + width,
  bottom: top + height,
});

describe('clampIntoRange', () => {
  it('keeps the lower bound when the range is empty', () => {
    expect(clampIntoRange(50, 8, 4)).toBe(8);
    expect(clampIntoRange(50, 8, 100)).toBe(50);
  });
});

describe('shiftIntoRange', () => {
  it('stays put inside the room', () => {
    expect(shiftIntoRange(20, 220, 390)).toBe(0);
  });
  it('slides back from past the end, and in from before the start', () => {
    expect(shiftIntoRange(300, 500, 390)).toBe(-118);
    expect(shiftIntoRange(-50, 50, 390)).toBe(58);
  });
  it('keeps the start edge in for a span longer than the room', () => {
    expect(shiftIntoRange(100, 600, 390)).toBe(-92);
    expect(shiftIntoRange(100, 600, 390, 0)).toBe(-100);
  });
});

describe('overlayMaxWidth', () => {
  it('is the screen less its margins, never below zero', () => {
    expect(overlayMaxWidth(390)).toBe(374);
    expect(overlayMaxWidth(10)).toBe(0);
    expect(OVERLAY_MAX_WIDTH).toBe('calc(100vw - 16px)');
  });
});

describe('keepOnScreen', () => {
  it('leaves an overlay that fits where it is', () => {
    expect(keepOnScreen(box(20, 100, 200, 40), PHONE)).toEqual({ x: 0, y: 0 });
  });

  it('right edge: a line hung from an element near the right of a phone slides left, 8px in', () => {
    expect(keepOnScreen(box(300, 100, 200, 20), PHONE)).toEqual({ x: -118, y: 0 });
  });

  it('left edge: one past the left slides right, 8px in', () => {
    expect(keepOnScreen(box(-40, 100, 200, 20), PHONE)).toEqual({ x: 48, y: 0 });
  });

  it('bottom edge: one under its anchor flips above it, the same gap away', () => {
    // Anchor 780 to 800, the card 6px under it, 120 tall: it runs off the foot, so it opens 6px above the anchor.
    const shift = keepOnScreen(box(20, 806, 200, 120), PHONE, {
      anchor: { top: 780, bottom: 800 },
    });
    expect(shift).toEqual({ x: 0, y: 654 - 806 });
  });

  it('bottom edge: with no room above either, or no anchor, it slides up instead', () => {
    expect(
      keepOnScreen(box(20, 806, 200, 120), PHONE, { anchor: { top: 50, bottom: 800 } }),
    ).toEqual({ x: 0, y: 844 - 8 - 926 });
    expect(keepOnScreen(box(20, 806, 200, 120), PHONE)).toEqual({ x: 0, y: -90 });
  });

  it('top edge: one above its anchor flips below it, the same gap away', () => {
    // Anchor 20 to 40, the toolbar ending 4px over it, 30 tall: its top is off screen, so it opens 4px under.
    const shift = keepOnScreen(box(20, -14, 200, 30), PHONE, { anchor: { top: 20, bottom: 40 } });
    expect(shift).toEqual({ x: 0, y: 44 - -14 });
  });

  it('top edge: with no room below, or no anchor, it slides down instead', () => {
    expect(
      keepOnScreen(box(20, -14, 200, 30), PHONE, { anchor: { top: 20, bottom: 830 } }),
    ).toEqual({ x: 0, y: 22 });
    expect(keepOnScreen(box(20, -14, 200, 30), PHONE)).toEqual({ x: 0, y: 22 });
  });

  it('an overlay sitting over its anchor slides rather than flips', () => {
    expect(
      keepOnScreen(box(20, 830, 200, 40), PHONE, { anchor: { top: 820, bottom: 860 } }),
    ).toEqual({
      x: 0,
      y: -34,
    });
  });

  it('slides and flips at once in a corner', () => {
    expect(
      keepOnScreen(box(350, 806, 200, 120), PHONE, { anchor: { top: 780, bottom: 800 } }),
    ).toEqual({ x: -168, y: -152 });
  });
});
