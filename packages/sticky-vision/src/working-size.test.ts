import { describe, expect, it } from 'vitest';
import { workingSizeOf } from './working-size';

// The size the detector sees a photograph at. ONE rule for the editor and for
// the calibration sweep, so the sweep measures the image the product sees.
describe('workingSizeOf', () => {
  it('shrinks the long edge to the working edge, keeping the shape', () => {
    expect(workingSizeOf(4000, 2252, 1000)).toMatchObject({ width: 1000, height: 563 });
    expect(workingSizeOf(1036, 3456, 1000)).toMatchObject({ width: 300, height: 1000 });
  });

  it('never upscales: a small photo is seen at its own size', () => {
    expect(workingSizeOf(800, 600, 1000)).toMatchObject({ width: 800, height: 600 });
  });

  it('gives the exact scale, not one rounded through the sides', () => {
    expect(workingSizeOf(3000, 2000, 1000).scale).toBe(1 / 3);
    expect(workingSizeOf(800, 600, 1000).scale).toBe(1);
  });

  it('never rounds a side to nothing', () => {
    expect(workingSizeOf(100000, 10, 1000)).toMatchObject({ width: 1000, height: 1 });
  });
});
