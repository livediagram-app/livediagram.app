import { describe, expect, it } from 'vitest';
import { exportScale, MAX_EXPORT_CANVAS_AREA, MAX_EXPORT_CANVAS_SIDE } from './export-canvas';

describe('exportScale', () => {
  it('keeps the wanted scale for a drawing that fits', () => {
    expect(exportScale(2, 2000, 2000)).toBe(2);
    expect(exportScale(3, 100, 80)).toBe(3);
  });

  it('lowers the scale so the longest side fits', () => {
    expect(exportScale(2, 40000, 10) * 40000).toBeLessThanOrEqual(MAX_EXPORT_CANVAS_SIDE);
  });

  // iOS Safari draws nothing on a canvas past 16.7 MP, however short its sides: 8000 x 6000 at 2x was a
  // 16128 x 12128 canvas (195.6 MP), under the side cap.
  it('lowers the scale so the whole-pixel canvas fits the area cap, keeping its shape', () => {
    const s = exportScale(2, 8048, 6048);
    const area = Math.ceil(8048 * s) * Math.ceil(6048 * s);
    expect(area).toBeLessThanOrEqual(MAX_EXPORT_CANVAS_AREA);
    expect(area).toBeGreaterThan(MAX_EXPORT_CANVAS_AREA * 0.99);
  });

  it('never rounds a part pixel past either cap', () => {
    const sizes: [number, number][] = [
      [8048.3, 6048.7],
      [4096.5, 4096.5],
      [100000, 170],
      [3001, 9973.1],
      [16384, 16384],
    ];
    for (const [w, h] of sizes) {
      const s = exportScale(2, w, h);
      expect(Math.ceil(w * s) * Math.ceil(h * s)).toBeLessThanOrEqual(MAX_EXPORT_CANVAS_AREA);
      expect(Math.max(w, h) * s).toBeLessThanOrEqual(MAX_EXPORT_CANVAS_SIDE);
    }
  });

  it('answers the side cap alone for an empty drawing', () => {
    expect(exportScale(2, 0, 0)).toBe(2);
    expect(exportScale(2, 0, 40000)).toBe(MAX_EXPORT_CANVAS_SIDE / 40000);
  });
});
