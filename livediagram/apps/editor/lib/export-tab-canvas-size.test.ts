// @vitest-environment jsdom
// The PNG's pixel size (docs/specs/020-import-export/export-fidelity.md). A tab whose padded size was 424.5 x 119.9
// came out 424 x 119 pixels: the canvas was sized down to whole pixels, so the last part-pixel row and column, an
// element's border and corners there, were cut off.
import { describe, expect, it } from 'vitest';
import { EXPORT_PADDING, type Tab } from '@livediagram/document';
import {
  exportScale,
  MAX_EXPORT_CANVAS_AREA,
  MAX_EXPORT_CANVAS_SIDE,
  renderTabToCanvas,
} from './export-tab';

const tab = (width: number, height: number): Tab => ({
  id: 'tab-1',
  name: 'My Tab',
  elements: [{ id: 'a', type: 'shape', shape: 'square', x: 0, y: 0, width, height }],
});
// The padded size, at a scale.
const padded = (n: number, scale: number) => (n + EXPORT_PADDING * 2) * scale;

describe('renderTabToCanvas size', () => {
  it('rounds a part pixel up, so nothing of the tab is cut off', async () => {
    const one = await renderTabToCanvas(tab(360.5, 55.9), { scale: 1 });
    expect([one.width, one.height]).toEqual([
      Math.ceil(padded(360.5, 1)),
      Math.ceil(padded(55.9, 1) - 1e-6),
    ]);
    expect(one.width).toBeGreaterThan(padded(360.5, 1));
    const three = await renderTabToCanvas(tab(360.5, 55.92), { scale: 3 });
    expect(three.width).toBeGreaterThanOrEqual(padded(360.5, 3));
    expect(three.height).toBeGreaterThanOrEqual(padded(55.92, 3));
  });

  it('keeps whole sizes whole and never passes the canvas limit', async () => {
    const whole = await renderTabToCanvas(tab(100, 80), { scale: 2 });
    expect([whole.width, whole.height]).toEqual([padded(100, 2), padded(80, 2)]);
    const huge = await renderTabToCanvas(tab(40000.3, 10), { scale: 2 });
    expect(huge.width).toBeLessThanOrEqual(MAX_EXPORT_CANVAS_SIDE);
  });

  // iOS Safari draws nothing on a canvas past 16.7 MP, however short its sides: an 8000 x 6000 tab at 2x was a
  // 16128 x 12128 canvas (195.6 MP) under the side cap, and its PNG came out blank there; now 4723 x 3552.
  it('keeps a big tab under the canvas area limit, with its shape', async () => {
    const big = await renderTabToCanvas(tab(8000, 6000), { scale: 2 });
    expect(big.width * big.height).toBeLessThanOrEqual(MAX_EXPORT_CANVAS_AREA);
    expect(big.width * big.height).toBeGreaterThan(MAX_EXPORT_CANVAS_AREA * 0.99);
    expect(big.width / big.height).toBeCloseTo(padded(8000, 1) / padded(6000, 1), 2);
  });

  it('never rounds a part pixel past the area limit', () => {
    const sizes: [number, number][] = [
      [8048.3, 6048.7],
      [4096.5, 4096.5],
      [100000, 170],
      [3001, 9973.1],
    ];
    for (const [w, h] of sizes) {
      const s = exportScale(2, w, h);
      expect(Math.ceil(w * s) * Math.ceil(h * s)).toBeLessThanOrEqual(MAX_EXPORT_CANVAS_AREA);
      expect(Math.max(w, h) * s).toBeLessThanOrEqual(MAX_EXPORT_CANVAS_SIDE);
    }
    // A tab that fits keeps its full 2x.
    expect(exportScale(2, 2000, 2000)).toBe(2);
  });
});
