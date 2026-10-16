import { describe, expect, it } from 'vitest';
import { ZOOM_MAX } from './canvas';
import { DOUBLE_TAP_MIN_ZOOM, doubleTapZoomView, isDoubleTapZoomPointer } from './double-tap-zoom';
import { computeViewportCenter } from './viewport';

// Double-tap to zoom (docs/specs/008-canvas/canvas-and-palette.md "Double-tap to zoom").

const PHONE = { width: 390, height: 700 };

describe('isDoubleTapZoomPointer', () => {
  it('is a finger only: a mouse, a trackpad and a pen keep the text drop', () => {
    expect(isDoubleTapZoomPointer('touch')).toBe(true);
    expect(isDoubleTapZoomPointer('mouse')).toBe(false);
    expect(isDoubleTapZoomPointer('pen')).toBe(false);
    expect(isDoubleTapZoomPointer(null)).toBe(false);
  });
});

describe('doubleTapZoomView', () => {
  it('puts the tapped point in the middle of the canvas', () => {
    const view = doubleTapZoomView({ x: 840, y: -120 }, 1.5, PHONE);
    expect(computeViewportCenter(PHONE, view.offset)).toEqual({ x: 840, y: -120 });
  });

  it('doubles the zoom', () => {
    expect(doubleTapZoomView({ x: 0, y: 0 }, 1.5, PHONE).zoom).toBe(3);
  });

  it("lands a phone's zoomed-out view at a readable size", () => {
    expect(doubleTapZoomView({ x: 0, y: 0 }, 0.6, PHONE).zoom).toBe(1.2);
    expect(doubleTapZoomView({ x: 0, y: 0 }, 0.2, PHONE).zoom).toBe(DOUBLE_TAP_MIN_ZOOM);
  });

  it('stops at the zoom cap, and at the cap only centres', () => {
    expect(doubleTapZoomView({ x: 0, y: 0 }, 4, PHONE).zoom).toBe(ZOOM_MAX);
    const atCap = doubleTapZoomView({ x: 10, y: 20 }, ZOOM_MAX, PHONE);
    expect(atCap.zoom).toBe(ZOOM_MAX);
    expect(atCap.offset).toEqual({ x: 185, y: 330 });
  });
});
