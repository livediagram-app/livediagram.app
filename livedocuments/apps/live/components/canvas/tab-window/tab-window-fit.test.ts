import { describe, expect, it } from 'vitest';
import { drawingFit } from './TabWindowDrawing';

// docs/specs/009-elements/tab-window.md "The element": the shown tab's pattern sits behind the drawing at its fit,
// lined up with what is drawn.
describe('drawingFit', () => {
  it('fits the drawing inside the frame, centred, and says where canvas (0, 0) falls', () => {
    // A 400 x 200 drawing whose top-left is canvas (100, 50), in a 640 x 360 frame: fitted by width (k 1.6),
    // centred vertically (top 20).
    expect(
      drawingFit({ w: 640, h: 360 }, { width: 400, height: 200, origin: { x: 100, y: 50 } }),
    ).toEqual({
      k: 1.6,
      origin: { x: -160, y: -60 },
    });
  });

  it('fits a tall drawing by its height', () => {
    const fit = drawingFit({ w: 640, h: 360 }, { width: 100, height: 400, origin: { x: 0, y: 0 } });
    expect(fit.k).toBe(0.9);
    expect(fit.origin).toEqual({ x: 275, y: 0 });
  });
});
