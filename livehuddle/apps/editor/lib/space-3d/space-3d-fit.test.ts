import { describe, expect, it } from 'vitest';
import { computeFitToScreen } from '@liveworkspace/workbench/lib/viewport';
import { FIT_3D_TOP, fit3DView } from './space-3d-fit';
import { SPACE_3D_TILT_DEG, screenBoxOf } from './space-3d-camera';

// Fit frames the Space as it stands (docs/specs/008-canvas/3d-view.md): a wide Space (Virtual Office's 1800 x 700),
// its walls standing, inside a laptop's canvas less the padding.
const size = { width: 1280, height: 760 };
const bbox = { x: 100, y: 200, width: 1800, height: 700 };
const pad = { x: 60, y: 80 };
const corners = [bbox.x, bbox.x + bbox.width].flatMap((x) =>
  [bbox.y, bbox.y + bbox.height].flatMap((y) => [0, FIT_3D_TOP].map((z) => ({ x, y, z }))),
);

describe('fit3DView', () => {
  it('keeps the whole Space, walls and near corners, inside the padded canvas at every quarter turn', () => {
    for (const turn of [0, 1, 2, 3]) {
      const view = fit3DView(size, bbox, pad, SPACE_3D_TILT_DEG, turn);
      const box = screenBoxOf(corners, size, view, SPACE_3D_TILT_DEG, undefined, turn);
      expect(box.x).toBeGreaterThanOrEqual(pad.x - 1);
      expect(box.x + box.width).toBeLessThanOrEqual(size.width - pad.x + 1);
      expect(box.y).toBeGreaterThanOrEqual(pad.y - 1);
      expect(box.y + box.height).toBeLessThanOrEqual(size.height - pad.y + 1);
      // Centred, and filling one side (not left small).
      expect(Math.abs(box.x + box.width / 2 - size.width / 2)).toBeLessThan(2);
      expect(Math.abs(box.y + box.height / 2 - size.height / 2)).toBeLessThan(2);
      const fill = Math.max(
        box.width / (size.width - 2 * pad.x),
        box.height / (size.height - 2 * pad.y),
      );
      expect(fill).toBeGreaterThan(0.98);
    }
  });

  it('crops where the flat fit did: its near corners ran off the sides', () => {
    const flat = computeFitToScreen(size, bbox, undefined, pad.x);
    const box = screenBoxOf(corners, size, flat, SPACE_3D_TILT_DEG);
    expect(box.x < 0 || box.x + box.width > size.width).toBe(true);
  });

  it('never zooms past 100%, for a small Space', () => {
    const view = fit3DView(size, { x: 0, y: 0, width: 100, height: 80 }, pad, SPACE_3D_TILT_DEG);
    expect(view.zoom).toBe(1);
  });
});
