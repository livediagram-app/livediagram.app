import { describe, expect, it } from 'vitest';
import { ZOOM_MAX } from './canvas';
import {
  DOUBLE_TAP_FRAME_MAX_ZOOM,
  DOUBLE_TAP_MIN_ZOOM,
  DOUBLE_TAP_SMALL_ELEMENT_PX,
  doubleTapFitsTab,
  doubleTapFrameView,
  doubleTapZoomView,
  isDoubleTapZoomPointer,
} from './double-tap-zoom';
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

describe('doubleTapFrameView', () => {
  const box = { x: 100, y: 200, width: 160, height: 60 };
  const small = { width: 160 * 0.25, height: 60 * 0.25 };

  it('frames a small element in the middle of the canvas', () => {
    const view = doubleTapFrameView(box, small, 0.25, PHONE)!;
    expect(computeViewportCenter(PHONE, view.offset)).toEqual({ x: 180, y: 230 });
    // 160 wide into a 390 canvas less the padding either side.
    expect(view.zoom).toBeCloseTo((390 - 120) / 160);
  });

  it('edits at once at 100% or more, however small the element', () => {
    expect(
      doubleTapFrameView(box, { width: 10, height: 10 }, DOUBLE_TAP_MIN_ZOOM, PHONE),
    ).toBeNull();
    expect(doubleTapFrameView(box, { width: 10, height: 10 }, 1.5, PHONE)).toBeNull();
  });

  it('edits at once when its shorter side is a fingertip or more on screen', () => {
    expect(
      doubleTapFrameView(box, { width: 200, height: DOUBLE_TAP_SMALL_ELEMENT_PX }, 0.6, PHONE),
    ).toBeNull();
    expect(
      doubleTapFrameView(box, { width: 200, height: DOUBLE_TAP_SMALL_ELEMENT_PX - 1 }, 0.6, PHONE),
    ).not.toBeNull();
  });

  it('caps a tiny element at 200%, so it does not fill the screen', () => {
    const tiny = { x: 0, y: 0, width: 20, height: 20 };
    expect(doubleTapFrameView(tiny, { width: 4, height: 4 }, 0.2, PHONE)!.zoom).toBe(
      DOUBLE_TAP_FRAME_MAX_ZOOM,
    );
  });

  it('lands at 100% or more, so the next double-tap edits, even for a long thin element', () => {
    const line = { x: 0, y: 0, width: 3000, height: 2 };
    const view = doubleTapFrameView(line, { width: 900, height: 1 }, 0.3, PHONE)!;
    expect(view.zoom).toBe(DOUBLE_TAP_MIN_ZOOM);
    expect(doubleTapFrameView(line, { width: 3000, height: 2 }, view.zoom, PHONE)).toBeNull();
  });
});

describe('doubleTapFitsTab', () => {
  const fit = { zoom: 0.4, offset: { x: 0, y: 0 } };

  it('fits only right after a double-tap zoomed in', () => {
    expect(doubleTapFitsTab(true, 1.2, fit)).toBe(true);
    expect(doubleTapFitsTab(false, 1.2, fit)).toBe(false);
  });

  it('zooms in again once the view is back at the fit or wider', () => {
    expect(doubleTapFitsTab(true, 0.4, fit)).toBe(false);
    expect(doubleTapFitsTab(true, 0.3, fit)).toBe(false);
  });

  it('zooms in when there is no fit to go to', () => {
    expect(doubleTapFitsTab(true, 1.2, null)).toBe(false);
  });
});
