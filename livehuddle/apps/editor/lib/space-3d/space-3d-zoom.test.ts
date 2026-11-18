import { describe, expect, it } from 'vitest';
import { SPACE_3D_ZOOM, space3DZoomIn, space3DZoomOut } from './space-3d-zoom';

describe('the 3D view zooms closer (docs/specs/008-canvas/3d-view.md "It brings the camera closer")', () => {
  it('zooms in on the way up, within the limits', () => {
    expect(space3DZoomIn(1, 0.1, 5)).toBeCloseTo(SPACE_3D_ZOOM);
    expect(space3DZoomIn(4, 0.1, 5)).toBe(5);
  });

  it('comes back to the zoom you had when you did not zoom in 3D, even after a clamp', () => {
    expect(space3DZoomOut(5, { from: 4, to: 5 }, 0.1, 5)).toBe(4);
  });

  it('zooms back out by the same step when you zoomed in 3D, within the limits', () => {
    expect(space3DZoomOut(2.8, { from: 1, to: 1.4 }, 0.1, 5)).toBeCloseTo(2);
    expect(space3DZoomOut(0.1, null, 0.1, 5)).toBe(0.1);
  });
});
