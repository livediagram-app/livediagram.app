import { describe, expect, it } from 'vitest';
import {
  FIT_TO_SCREEN_MAX,
  FIT_TO_SCREEN_MAX_AT_FIT,
  FIT_TO_SCREEN_MIN,
  FIT_TO_SCREEN_PADDING,
  computeFitBelow,
  computeFitToScreen,
  computeViewportCenter,
  isContentOffScreen,
} from './viewport';

describe('computeFitToScreen', () => {
  // A "comfortable" viewport / bbox pairing: bbox sits well inside the
  // viewport with margin, so the fit zoom hits the MAX_AT_FIT ceiling
  // (no magnify past 100%).
  const viewport = { width: 1200, height: 800 };

  it('caps zoom at FIT_TO_SCREEN_MAX_AT_FIT so a sparse canvas never magnifies past 100%', () => {
    const bbox = { x: 0, y: 0, width: 100, height: 50 };
    const out = computeFitToScreen(viewport, bbox);
    expect(out.zoom).toBe(FIT_TO_SCREEN_MAX_AT_FIT);
  });

  it('centres the bbox in the viewport regardless of bbox origin', () => {
    const bbox = { x: 200, y: 300, width: 400, height: 200 };
    const out = computeFitToScreen(viewport, bbox);
    // Bbox centre is (400, 400). Viewport centre is (600, 400).
    // Offset = viewport-centre minus bbox-centre = (200, 0).
    expect(out.offset).toEqual({ x: 200, y: 0 });
  });

  it('shrinks zoom to fit a wide bbox inside the viewport with padding', () => {
    // Bbox is 2000 wide. Available width is 1200 - 2 * 60 = 1080.
    // Width-bound zoom = 1080 / 2000 = 0.54. Height-bound is much
    // looser (bbox.h = 100, available = 680), so width wins.
    const bbox = { x: 0, y: 0, width: 2000, height: 100 };
    const out = computeFitToScreen(viewport, bbox);
    const expectedZoom = (viewport.width - 2 * FIT_TO_SCREEN_PADDING) / 2000;
    expect(out.zoom).toBeCloseTo(expectedZoom);
  });

  it('shrinks zoom to fit a tall bbox inside the viewport with padding', () => {
    // Bbox is 4000 tall. Height-bound zoom = (800 - 120) / 4000 =
    // 0.17. Width-bound zoom is 1080 / 100 = 10.8 (capped at the
    // global max), so height wins.
    const bbox = { x: 0, y: 0, width: 100, height: 4000 };
    const out = computeFitToScreen(viewport, bbox);
    const expectedZoom = (viewport.height - 2 * FIT_TO_SCREEN_PADDING) / 4000;
    expect(out.zoom).toBeCloseTo(expectedZoom);
  });

  it('clamps zoom at FIT_TO_SCREEN_MIN so a massive bbox stays visible', () => {
    // Bbox so large the natural fit would be < 0.001. Min floor
    // is the only thing keeping it visible.
    const bbox = { x: 0, y: 0, width: 1_000_000, height: 1_000_000 };
    const out = computeFitToScreen(viewport, bbox);
    expect(out.zoom).toBe(FIT_TO_SCREEN_MIN);
  });

  it('does not divide by zero on a zero-width bbox (degenerate single point)', () => {
    const bbox = { x: 100, y: 100, width: 0, height: 0 };
    const out = computeFitToScreen(viewport, bbox);
    expect(Number.isFinite(out.zoom)).toBe(true);
    expect(out.zoom).toBeGreaterThan(0);
    expect(Number.isFinite(out.offset.x)).toBe(true);
    expect(Number.isFinite(out.offset.y)).toBe(true);
  });

  it('respects the FIT_TO_SCREEN_PADDING constant by reserving margin on both axes', () => {
    // A bbox exactly the size of the available area (viewport minus
    // padding on each side) should hit zoom = 1 (or MAX_AT_FIT).
    const bbox = {
      x: 0,
      y: 0,
      width: viewport.width - 2 * FIT_TO_SCREEN_PADDING,
      height: viewport.height - 2 * FIT_TO_SCREEN_PADDING,
    };
    const out = computeFitToScreen(viewport, bbox);
    expect(out.zoom).toBe(FIT_TO_SCREEN_MAX_AT_FIT);
  });

  it('respects the FIT_TO_SCREEN_MAX global ceiling above MAX_AT_FIT', () => {
    // Sanity: max must be at least as loose as MAX_AT_FIT (so the
    // first clamp doesn't make the second meaningless), and the
    // floor must be tighter than both. Catches a future tweak that
    // accidentally inverts the order.
    expect(FIT_TO_SCREEN_MAX).toBeGreaterThanOrEqual(FIT_TO_SCREEN_MAX_AT_FIT);
    expect(FIT_TO_SCREEN_MIN).toBeLessThan(FIT_TO_SCREEN_MAX_AT_FIT);
  });
});

describe('computeViewportCenter', () => {
  it('returns the viewport-centre minus the offset (canvas-coord)', () => {
    expect(computeViewportCenter({ width: 800, height: 400 }, { x: 0, y: 0 })).toEqual({
      x: 400,
      y: 200,
    });
  });

  it('shifts the centre by the negative of the pan offset', () => {
    // After panning the canvas 150 right and 75 down, the canvas
    // coordinate at viewport centre moves the opposite way.
    expect(computeViewportCenter({ width: 800, height: 400 }, { x: 150, y: 75 })).toEqual({
      x: 250,
      y: 125,
    });
  });
});

describe('isContentOffScreen', () => {
  const viewport = { width: 1000, height: 600 };
  const bbox = { x: 0, y: 0, width: 200, height: 100 };

  it('is false when the bbox is centred in the viewport', () => {
    // Offset that centres the bbox (the computeFitToScreen offset).
    const offset = { x: viewport.width / 2 - 100, y: viewport.height / 2 - 50 };
    expect(isContentOffScreen(viewport, bbox, offset, 1)).toBe(false);
  });

  it('is false when the bbox only partly overlaps an edge', () => {
    // Push the bbox left until its right edge sits just inside x=0..width.
    const offset = { x: -190, y: viewport.height / 2 - 50 };
    expect(isContentOffScreen(viewport, bbox, offset, 1)).toBe(false);
  });

  it('is true when the bbox is entirely off the left edge', () => {
    // Right edge of the bbox projects to <= 0.
    const offset = { x: -600, y: viewport.height / 2 - 50 };
    expect(isContentOffScreen(viewport, bbox, offset, 1)).toBe(true);
  });

  it('is true when the bbox is entirely below the viewport', () => {
    const offset = { x: viewport.width / 2 - 100, y: 800 };
    expect(isContentOffScreen(viewport, bbox, offset, 1)).toBe(true);
  });

  it('accounts for zoom when projecting (zoomed-in content scrolls off faster)', () => {
    // Centred bbox, but zoomed 4x and panned so it clears the right edge.
    const offset = { x: 1200, y: viewport.height / 2 - 50 };
    expect(isContentOffScreen(viewport, bbox, offset, 4)).toBe(true);
  });
});

// Infographic mode centres its page below the Toolbar layout's strip
// (docs/specs/007-editor/editor-modes.md "The pages").
describe('computeFitBelow', () => {
  const rect = { width: 1200, height: 800 };
  const box = { x: -500, y: -500, width: 1000, height: 1000 };
  // Where a canvas y lands on screen under the centred transform.
  const screenY = (cy: number, zoom: number, oy: number) =>
    rect.height / 2 + zoom * (cy + oy - rect.height / 2);

  it('matches the plain fit with no inset', () => {
    expect(computeFitBelow(rect, box, 0)).toEqual(computeFitToScreen(rect, box));
  });

  it('centres the box in the band below the inset, zoomed to fit that band', () => {
    const { zoom, offset } = computeFitBelow(rect, box, 100);
    expect(zoom).toBeLessThan(computeFitToScreen(rect, box).zoom);
    const top = screenY(box.y, zoom, offset.y);
    const bottom = screenY(box.y + box.height, zoom, offset.y);
    expect(top).toBeGreaterThanOrEqual(100);
    expect((top + bottom) / 2).toBeCloseTo((100 + rect.height) / 2);
  });
});
