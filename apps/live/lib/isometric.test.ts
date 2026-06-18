import { describe, expect, it } from 'vitest';
import {
  clampElevation,
  ISO_DEPTH_PX,
  ISO_ELEVATION_RANGE,
  ISO_LAYER_STEP_PX,
  ISO_TILT_DEG,
  isoDepthLayers,
  isoLayerBrightness,
  isoTransform,
} from './isometric';

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

describe('isoLayerBrightness', () => {
  it('is full just under the element and dims toward the floor', () => {
    expect(isoLayerBrightness(0, 10)).toBeCloseTo(1);
    expect(isoLayerBrightness(9, 10)).toBeCloseTo(0.5);
  });

  it('decreases monotonically', () => {
    let prev = Infinity;
    for (let i = 0; i < 10; i++) {
      const b = isoLayerBrightness(i, 10);
      expect(b).toBeLessThan(prev);
      prev = b;
    }
  });

  it('handles a single-layer stack without dividing by zero', () => {
    expect(isoLayerBrightness(0, 1)).toBe(1);
  });
});

describe('clampElevation', () => {
  it('clamps to the allowed orbit range', () => {
    expect(clampElevation(0)).toBe(ISO_ELEVATION_RANGE.min);
    expect(clampElevation(90)).toBe(ISO_ELEVATION_RANGE.max);
    expect(clampElevation(55)).toBe(55);
  });
});

describe('isoTransform', () => {
  it('builds a rotateX (elevation) + rotateZ (azimuth) string', () => {
    expect(isoTransform(-45, 55)).toBe('rotateX(55deg) rotateZ(-45deg)');
  });

  it('reflects the default camera angles', () => {
    expect(isoTransform(ISO_TILT_DEG.z, ISO_TILT_DEG.x)).toContain(`rotateX(${ISO_TILT_DEG.x}deg)`);
  });
});
