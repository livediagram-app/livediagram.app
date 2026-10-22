import { afterEach, describe, expect, it } from 'vitest';
import { raiseZoomCeiling, zoomCeilingRaised, zoomMax, ZOOM_MAX } from './canvas';
import { doubleTapZoomView } from './double-tap-zoom';

// docs/specs/031-photo/photo-pages.md "Navigating": the zoom ceiling rises while a photo page is in focus.
afterEach(() => raiseZoomCeiling(null));

describe('the zoom ceiling', () => {
  it('is ZOOM_MAX until a photo page raises it, never lower', () => {
    expect(zoomMax()).toBe(ZOOM_MAX);
    expect(zoomCeilingRaised()).toBe(false);
    raiseZoomCeiling(128);
    expect(zoomMax()).toBe(128);
    expect(zoomCeilingRaised()).toBe(true);
    raiseZoomCeiling(2);
    expect(zoomMax()).toBe(ZOOM_MAX);
    raiseZoomCeiling(null);
    expect(zoomMax()).toBe(ZOOM_MAX);
  });

  it('lets a double tap zoom past ZOOM_MAX while raised', () => {
    const phone = { width: 390, height: 844 };
    raiseZoomCeiling(40);
    expect(doubleTapZoomView({ x: 0, y: 0 }, 20, phone).zoom).toBeGreaterThan(ZOOM_MAX);
  });
});
