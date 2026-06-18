import { describe, expect, it } from 'vitest';
import { ISO_DEPTH_PX, ISO_LAYER_STEP_PX, isoDepthLayers, isoLayerColor } from './isometric';

describe('isoDepthLayers', () => {
  it('descends from just below the element to the floor depth', () => {
    const layers = isoDepthLayers(30, 2);
    expect(layers[0]).toBe(-2);
    expect(layers[layers.length - 1]).toBe(-30);
    expect(layers).toHaveLength(15);
  });

  it('is strictly monotonic (each layer deeper than the last)', () => {
    const layers = isoDepthLayers();
    for (let i = 1; i < layers.length; i++) {
      expect(layers[i]!).toBeLessThan(layers[i - 1]!);
    }
  });

  it('never overshoots the requested depth', () => {
    const layers = isoDepthLayers(31, 4); // 31 not divisible by 4
    expect(Math.min(...layers)).toBeGreaterThanOrEqual(-31);
  });

  it('defaults to the exported depth + step', () => {
    expect(isoDepthLayers()).toEqual(isoDepthLayers(ISO_DEPTH_PX, ISO_LAYER_STEP_PX));
  });
});

describe('isoLayerColor', () => {
  it('darkens toward the floor', () => {
    const top = isoLayerColor(0, 10);
    const floor = isoLayerColor(9, 10);
    expect(top).not.toBe(floor);
    // alpha rises with index → the floor string sorts after the top one
    expect(floor > top).toBe(true);
  });

  it('handles a single-layer stack without dividing by zero', () => {
    expect(isoLayerColor(0, 1)).toContain('0.600');
  });
});
