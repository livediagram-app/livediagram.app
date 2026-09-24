import { describe, expect, it } from 'vitest';
import { deltaE, labImageOf, rgbToLab } from './lab';

// CIELAB (D65, sRGB), the space where "how different is this paper from the
// wall" is a distance a person would agree with. Reference values from the
// CIE formulae as published by Bruce Lindbloom's calculator.

describe('rgbToLab', () => {
  const cases: [string, [number, number, number], [number, number, number]][] = [
    ['white', [255, 255, 255], [100, 0, 0]],
    ['black', [0, 0, 0], [0, 0, 0]],
    ['mid grey', [128, 128, 128], [53.585, 0, 0]],
    ['sRGB red', [255, 0, 0], [53.241, 80.092, 67.203]],
    ['sRGB green', [0, 255, 0], [87.735, -86.183, 83.179]],
    ['sRGB blue', [0, 0, 255], [32.297, 79.188, -107.86]],
    ['pale yellow aggregate', [0xfe, 0xf9, 0xc3], [97.131, -6.67, 26.586]],
  ];
  for (const [name, rgb, lab] of cases) {
    it(`converts ${name}`, () => {
      const out = rgbToLab(...rgb);
      expect(out.l).toBeCloseTo(lab[0], 0);
      expect(out.a).toBeCloseTo(lab[1], 0);
      expect(out.b).toBeCloseTo(lab[2], 0);
    });
  }

  it('keeps neutral greys neutral at every lightness', () => {
    for (let v = 0; v <= 255; v += 17) {
      const { a, b } = rgbToLab(v, v, v);
      expect(Math.abs(a)).toBeLessThan(0.01);
      expect(Math.abs(b)).toBeLessThan(0.01);
    }
  });
});

describe('deltaE', () => {
  it('is zero for one colour and grows with the difference', () => {
    const wall = rgbToLab(240, 240, 240);
    expect(deltaE(wall, wall)).toBe(0);
    const pale = rgbToLab(0xfe, 0xf9, 0xc3);
    const yellow = rgbToLab(0xfd, 0xe0, 0x47);
    expect(deltaE(wall, pale)).toBeGreaterThan(15);
    expect(deltaE(wall, yellow)).toBeGreaterThan(deltaE(wall, pale));
  });
});

describe('labImageOf', () => {
  it('converts a whole buffer into three planes matching the per-pixel conversion', () => {
    const data = new Uint8ClampedArray([255, 0, 0, 255, 12, 200, 99, 255, 0, 0, 0, 0]);
    const lab = labImageOf({ width: 3, height: 1, data });
    for (let p = 0; p < 3; p += 1) {
      const one = rgbToLab(data[p * 4]!, data[p * 4 + 1]!, data[p * 4 + 2]!);
      expect(lab.l[p]).toBeCloseTo(one.l, 3);
      expect(lab.a[p]).toBeCloseTo(one.a, 3);
      expect(lab.b[p]).toBeCloseTo(one.b, 3);
    }
  });

  it('converts a 1000px photograph quickly', () => {
    // A loose bound, like the detector's own speed test: the point is "not
    // seconds", not a benchmark. It normally takes about 30 ms; a tight
    // budget (150 ms) failed on a machine running every package's tests in
    // parallel while nothing was slow.
    const width = 1000;
    const height = 750;
    const data = new Uint8ClampedArray(width * height * 4);
    for (let i = 0; i < data.length; i += 1) data[i] = (i * 2654435761) >>> 24;
    const started = performance.now();
    labImageOf({ width, height, data });
    expect(performance.now() - started).toBeLessThan(750);
  });
});
