import { describe, expect, it } from 'vitest';
import {
  clampElevation,
  isoCanvasMatrix,
  isoProjectBounds,
  isoShapeSilhouette,
  ISO_DEPTH_PX,
  ISO_ELEVATION_RANGE,
  ISO_LAYER_STEP_PX,
  ISO_TILT_DEG,
  isoDepthLayers,
  isoLayerBrightness,
  isoPivot,
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

  it('wraps the rotation in pivot translates so the tilt rotates about the content', () => {
    expect(isoTransform(-45, 55, { x: 120, y: -30 })).toBe(
      'translate(120px, -30px) rotateX(55deg) rotateZ(-45deg) translate(-120px, 30px)',
    );
  });

  it('omits the pivot translates when no pivot is given', () => {
    expect(isoTransform(-45, 55)).toBe('rotateX(55deg) rotateZ(-45deg)');
  });
});

describe('isoPivot', () => {
  it('offsets the content centre by the wrapper (viewport) centre', () => {
    expect(isoPivot({ x: 500, y: 400 }, { width: 800, height: 600 })).toEqual({ x: 100, y: 100 });
  });

  it('is zero when the content is centred in the viewport', () => {
    expect(isoPivot({ x: 400, y: 300 }, { width: 800, height: 600 })).toEqual({ x: 0, y: 0 });
  });

  it('returns null when there is no content to centre on', () => {
    expect(isoPivot(null, { width: 800, height: 600 })).toBeNull();
  });
});

describe('isoShapeSilhouette', () => {
  it('clips polygonal shapes to their outline', () => {
    expect(isoShapeSilhouette('diamond').clipPath).toBe(
      'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)',
    );
    expect(isoShapeSilhouette('hexagon').clipPath).toContain('polygon(');
    expect(isoShapeSilhouette('diamond').borderRadius).toBeUndefined();
  });

  it('rounds curved shapes via border-radius (no clip path)', () => {
    expect(isoShapeSilhouette('circle').borderRadius).toBe('50%');
    expect(isoShapeSilhouette('cylinder').borderRadius).toBe('50% / 12%');
    expect(isoShapeSilhouette('circle').clipPath).toBeUndefined();
  });

  it('leaves the rectangular default for shapes without a silhouette', () => {
    expect(isoShapeSilhouette('square')).toEqual({
      clipPath: undefined,
      borderRadius: undefined,
    });
  });
});

describe('isoCanvasMatrix (spec/45 / 48 export projection)', () => {
  it('defaults to the on-screen camera angles', () => {
    const m = isoCanvasMatrix();
    const a = (ISO_TILT_DEG.z * Math.PI) / 180;
    const e = (ISO_TILT_DEG.x * Math.PI) / 180;
    expect(m.a).toBeCloseTo(Math.cos(a), 6);
    expect(m.c).toBeCloseTo(-Math.sin(a), 6);
    expect(m.b).toBeCloseTo(Math.cos(e) * Math.sin(a), 6);
    expect(m.d).toBeCloseTo(Math.cos(e) * Math.cos(a), 6);
  });

  it('a zero camera (no azimuth, flat elevation) is the identity', () => {
    const m = isoCanvasMatrix(0, 0);
    expect(m.a).toBeCloseTo(1, 6);
    expect(m.b).toBeCloseTo(0, 6);
    expect(m.c).toBeCloseTo(0, 6);
    expect(m.d).toBeCloseTo(1, 6);
  });

  it('squashes the vertical axis by cos(elevation)', () => {
    // No azimuth: x maps straight through, y is foreshortened by cos(e).
    const m = isoCanvasMatrix(0, 60);
    expect(m.a).toBeCloseTo(1, 6);
    expect(m.d).toBeCloseTo(Math.cos((60 * Math.PI) / 180), 6); // 0.5
    expect(m.b).toBeCloseTo(0, 6);
  });
});

describe('isoProjectBounds', () => {
  it('returns the axis-aligned box of the projected corners', () => {
    // Pure vertical squash → width unchanged, height halved.
    const m = isoCanvasMatrix(0, 60);
    const out = isoProjectBounds({ x: 0, y: 0, w: 100, h: 100 }, m);
    expect(out.w).toBeCloseTo(100, 6);
    expect(out.h).toBeCloseTo(50, 6);
  });

  it('grows the footprint when the scene is rotated', () => {
    const m = isoCanvasMatrix(); // default tilt
    const out = isoProjectBounds({ x: 0, y: 0, w: 100, h: 100 }, m);
    // A 45° spin widens the diagonal footprint beyond the original width.
    expect(out.w).toBeGreaterThan(100);
    expect(out.h).toBeLessThan(100); // and the tilt squashes the height
  });
});
