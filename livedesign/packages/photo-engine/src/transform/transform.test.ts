import { describe, expect, it } from 'vitest';
import { createRaster, pixelAt, setPixel, solidRaster } from '../raster/raster';
import { canvasShift, flipRaster, rotatePoint, rotateQuarter } from './geometry';
import {
  apply,
  chain,
  IDENTITY,
  invert,
  isAffine,
  multiply,
  quadToQuad,
  rotate,
  scale,
  skew,
  transformedBounds,
  translate,
} from './matrix';
import { resizeRaster, sampleInto } from './resample';
import { transformRaster } from './warp';

describe('matrices', () => {
  it('compose, apply and invert', () => {
    const m = chain(scale(2), translate(3, 4));
    expect(apply(m, { x: 1, y: 1 })).toEqual({ x: 5, y: 6 });
    const back = invert(m)!;
    const p = apply(back, apply(m, { x: 7, y: -2 }));
    expect(p.x).toBeCloseTo(7);
    expect(p.y).toBeCloseTo(-2);
    expect(invert([0, 0, 0, 0, 0, 0, 0, 0, 1])).toBeNull();
    expect(multiply(IDENTITY, m)).toEqual(m);
    const r = apply(rotate(Math.PI / 2), { x: 1, y: 0 });
    expect(r.x).toBeCloseTo(0);
    expect(r.y).toBeCloseTo(1);
    expect(isAffine(skew(0.1, 0))).toBe(true);
    expect(transformedBounds(rotate(Math.PI / 4), 10, 10).width).toBe(16);
  });
  it('maps a quad to a quad', () => {
    const from = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 },
    ];
    const to = [
      { x: 0, y: 0 },
      { x: 20, y: 2 },
      { x: 18, y: 15 },
      { x: 1, y: 12 },
    ];
    const h = quadToQuad(from, to)!;
    to.forEach((t, i) => {
      const p = apply(h, from[i]!);
      expect(p.x).toBeCloseTo(t.x, 6);
      expect(p.y).toBeCloseTo(t.y, 6);
    });
    expect(isAffine(h)).toBe(false);
    expect(
      quadToQuad(
        from,
        from.map(() => ({ x: 0, y: 0 })),
      ),
    ).toBeNull();
  });
});

describe('resampling', () => {
  it('keeps a flat colour flat at every interpolation', () => {
    const r = solidRaster(8, 8, [10, 200, 30, 255]);
    for (const how of ['bicubic', 'bilinear', 'nearest'] as const) {
      const up = resizeRaster(r, 13, 5, how);
      expect(up.width).toBe(13);
      expect(pixelAt(up, 6, 2)).toEqual([10, 200, 30, 255]);
    }
    const down = resizeRaster(solidRaster(64, 64, [1, 2, 3, 255]), 7, 7);
    expect(pixelAt(down, 3, 3)).toEqual([1, 2, 3, 255]);
  });
  it('brings no dark fringe from transparency', () => {
    const r = createRaster(2, 1);
    setPixel(r, 0, 0, [255, 255, 255, 255]);
    const up = resizeRaster(r, 8, 1, 'bilinear');
    for (let x = 0; x < 8; x++) {
      const p = pixelAt(up, x, 0);
      if (p[3] > 0) expect(p[0]).toBe(255);
    }
  });
  it('nearest keeps hard edges, and samples outside are transparent', () => {
    const r = createRaster(2, 1);
    setPixel(r, 0, 0, [255, 0, 0, 255]);
    setPixel(r, 1, 0, [0, 0, 255, 255]);
    const up = resizeRaster(r, 4, 1, 'nearest');
    expect(pixelAt(up, 1, 0)).toEqual([255, 0, 0, 255]);
    expect(pixelAt(up, 2, 0)).toEqual([0, 0, 255, 255]);
    const out = new Float64Array(4);
    sampleInto(r, -5, 0, 'nearest', out);
    expect([...out]).toEqual([0, 0, 0, 0]);
    sampleInto(r, -5, -5, 'bicubic', out);
    expect([...out]).toEqual([0, 0, 0, 0]);
  });
});

describe('warp', () => {
  it('moves and turns a raster', () => {
    const r = solidRaster(4, 2, [9, 9, 9, 255]);
    const moved = transformRaster(r, translate(10, 5), 'nearest')!;
    expect(moved.x).toBe(10);
    expect(moved.y).toBe(5);
    expect(pixelAt(moved.raster, 1, 1)).toEqual([9, 9, 9, 255]);
    const turned = transformRaster(r, rotate(Math.PI / 2), 'nearest')!;
    expect(turned.raster.width).toBe(2);
    expect(turned.raster.height).toBe(4);
    expect(transformRaster(r, [0, 0, 0, 0, 0, 0, 0, 0, 1])).toBeNull();
  });
});

describe('geometry', () => {
  const r = createRaster(3, 2);
  setPixel(r, 0, 0, [1, 0, 0, 255]);
  it('turns by quarters', () => {
    const q = rotateQuarter(r, 90);
    expect([q.width, q.height]).toEqual([2, 3]);
    expect(pixelAt(q, 1, 0)[0]).toBe(1);
    expect(pixelAt(rotateQuarter(r, 180), 2, 1)[0]).toBe(1);
    expect(pixelAt(rotateQuarter(r, 270), 0, 2)[0]).toBe(1);
  });
  it('flips', () => {
    expect(pixelAt(flipRaster(r, true), 2, 0)[0]).toBe(1);
    expect(pixelAt(flipRaster(r, false), 0, 1)[0]).toBe(1);
  });
  it('shifts by the anchor and turns points', () => {
    const from = { width: 100, height: 50 };
    const to = { width: 200, height: 150 };
    expect(canvasShift(from, to, 'top-left')).toEqual({ dx: 0, dy: 0 });
    expect(canvasShift(from, to, 'centre')).toEqual({ dx: 50, dy: 50 });
    expect(canvasShift(from, to, 'bottom-right')).toEqual({ dx: 100, dy: 100 });
    expect(rotatePoint(10, 5, from, 90)).toEqual({ x: 45, y: 10 });
    expect(rotatePoint(10, 5, from, 180)).toEqual({ x: 90, y: 45 });
    expect(rotatePoint(10, 5, from, 270)).toEqual({ x: 5, y: 90 });
  });
});
