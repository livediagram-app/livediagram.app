// Pin the natural-rect math so a future regression (e.g. someone
// reverting to the live-rect-based clamp) gets a failing test
// rather than a "popover stuck in its clamped position" UX bug.
//
// `clampToViewport` runs in the browser and reads window.innerWidth
// / window.innerHeight. Vitest's Node env doesn't have a real
// window, so the tests stub the two properties for the assertions
// they need.

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { clampToViewport } from './clamp-to-viewport';

const rect = (left: number, top: number, width: number, height: number): DOMRect =>
  ({
    x: left,
    y: top,
    left,
    top,
    width,
    height,
    right: left + width,
    bottom: top + height,
    toJSON() {
      return this;
    },
  }) as DOMRect;

const VW = 1200;
const VH = 800;

const originalWindow = globalThis.window;

beforeEach(() => {
  // Minimal `window` stub: only innerWidth / innerHeight matter for
  // the clamp. Cast through unknown to keep TS happy without
  // pulling in jsdom.
  (globalThis as unknown as { window: { innerWidth: number; innerHeight: number } }).window = {
    innerWidth: VW,
    innerHeight: VH,
  };
});

afterEach(() => {
  if (originalWindow) {
    (globalThis as unknown as { window: Window }).window = originalWindow;
  } else {
    delete (globalThis as unknown as Record<string, unknown>).window;
  }
});

describe('clampToViewport', () => {
  it('returns zero adjust for a box that already fits with no prior clamp', () => {
    const r = rect(400, 200, 200, 100);
    expect(clampToViewport(r, { x: 0, y: 0 })).toEqual({ x: 0, y: 0 });
  });

  it('pushes the box right when its left edge overflows past the margin', () => {
    const r = rect(-50, 200, 200, 100);
    const out = clampToViewport(r, { x: 0, y: 0 });
    // Natural left is -50; margin is 8. Push right by (8 - (-50)) = 58.
    expect(out.x).toBe(58);
    expect(out.y).toBe(0);
  });

  it('pushes the box left when its right edge overflows past the margin', () => {
    const r = rect(VW - 100, 200, 200, 100);
    const out = clampToViewport(r, { x: 0, y: 0 });
    // Natural right is VW + 100; pull left by (VW - 8) - (VW + 100) = -108.
    expect(out.x).toBe(-108);
    expect(out.y).toBe(0);
  });

  it('pushes the box up when its bottom edge overflows past the margin', () => {
    const r = rect(400, VH - 50, 200, 200);
    const out = clampToViewport(r, { x: 0, y: 0 });
    // Natural bottom is VH + 150; pull up by (VH - 8) - (VH + 150) = -158.
    expect(out.x).toBe(0);
    expect(out.y).toBe(-158);
  });

  it('uses the natural (pre-translate) rect when prevAdjust is non-zero so a stale clamp can relax back', () => {
    // The bug we're guarding against: a popover was clamped 50px
    // right last frame (prevAdjust.x = 50). This frame its rect
    // sits at left = 0 (already-translated), but the NATURAL
    // position is left = -50. The clamp should still report
    // x = 58 (pushing right by margin - naturalLeft), NOT see
    // "already in-frame" and report 0.
    const r = rect(0, 200, 200, 100);
    const out = clampToViewport(r, { x: 50, y: 0 });
    expect(out.x).toBe(58);
  });

  it('relaxes the clamp to zero when the natural position now fits', () => {
    // Inverse of the bug: previous frame had a 50px clamp, the
    // anchor moved (or the user resized), and the natural position
    // is now back in-frame. The clamp should report 0, not stay
    // stuck at 50.
    const r = rect(400, 200, 200, 100); // already-translated rect
    const out = clampToViewport(r, { x: 50, y: 0 });
    // Natural rect sits at left = 350, comfortably in-frame.
    expect(out).toEqual({ x: 0, y: 0 });
  });

  it('takes margin into account so the clamp leaves the configured gutter', () => {
    const r = rect(2, 200, 200, 100); // 2px from edge, margin 8
    const out = clampToViewport(r, { x: 0, y: 0 });
    expect(out.x).toBe(6);
  });

  it('accepts a custom margin value', () => {
    const r = rect(2, 200, 200, 100);
    const out = clampToViewport(r, { x: 0, y: 0 }, 16);
    expect(out.x).toBe(14);
  });
});
