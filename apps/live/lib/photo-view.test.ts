import { describe, expect, it } from 'vitest';
import { FIT, PHOTO_ZOOM_MAX, clampView, panBy, zoomAt } from './photo-view';

// Zooming and panning the photograph under review (spec/139 Phase 9). The
// picture is laid out at its FITTED size; the view is a zoom and an offset on
// top of that, in fitted-picture pixels, applied as
// `translate(x, y) scale(zoom)` with the origin at the top-left.
const size = { width: 1000, height: 500 };

describe('zoomAt', () => {
  it('keeps the point under the cursor under the cursor', () => {
    // Zooming on a sticky must not slide the sticky away from the pointer:
    // that is the whole difference between a zoom and a jump.
    const at = { x: 300, y: 200 };
    const view = zoomAt(FIT, size, 2, at);
    expect(view.zoom).toBe(2);
    // The picture point that was under the cursor (300,200) is still there.
    expect(view.x + 300 * view.zoom).toBeCloseTo(300);
    expect(view.y + 200 * view.zoom).toBeCloseTo(200);
  });

  it('never zooms out past the whole photo', () => {
    // Smaller than fit is empty frame around a small photo, which helps nobody.
    expect(zoomAt(FIT, size, 0.5, { x: 10, y: 10 })).toEqual(FIT);
  });

  it('stops at the most useful magnification', () => {
    const deep = zoomAt(FIT, size, 1000, { x: 500, y: 250 });
    expect(deep.zoom).toBe(PHOTO_ZOOM_MAX);
  });

  it('zooming back to fit puts the whole photo back, wherever it was panned', () => {
    const zoomed = zoomAt(FIT, size, 4, { x: 900, y: 450 });
    const back = zoomAt(zoomed, size, 1 / 4, { x: 100, y: 100 });
    expect(back).toEqual(FIT);
  });
});

describe('panBy', () => {
  it('moves the photo with the pointer', () => {
    const zoomed = zoomAt(FIT, size, 2, { x: 500, y: 250 });
    const moved = panBy(zoomed, size, 40, -30);
    expect(moved.x).toBe(zoomed.x + 40);
    expect(moved.y).toBe(zoomed.y - 30);
  });

  it('never pans the photo off its own frame', () => {
    // An edge of the photograph pulled inside the frame is empty space, and
    // a photo lost off-screen is one the author has to hunt for.
    const zoomed = zoomAt(FIT, size, 2, { x: 0, y: 0 });
    expect(panBy(zoomed, size, 5000, 5000)).toEqual({ zoom: 2, x: 0, y: 0 });
    expect(panBy(zoomed, size, -5000, -5000)).toEqual({ zoom: 2, x: -1000, y: -500 });
  });

  it('does nothing at fit, where there is nowhere to go', () => {
    expect(panBy(FIT, size, 100, 100)).toEqual(FIT);
  });
});

describe('clampView', () => {
  it('pulls a view back inside when the frame changes size under it', () => {
    // The window is resized while zoomed: the same offset may now reach past
    // the photo's edge.
    expect(clampView({ zoom: 2, x: -1900, y: 10 }, size)).toEqual({ zoom: 2, x: -1000, y: 0 });
  });

  it('survives a picture that has not been laid out yet', () => {
    expect(clampView({ zoom: 3, x: -50, y: -50 }, { width: 0, height: 0 })).toEqual({
      zoom: 3,
      x: 0,
      y: 0,
    });
  });
});
