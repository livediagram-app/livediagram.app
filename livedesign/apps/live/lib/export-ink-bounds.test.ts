// Ink past a text's box (docs/specs/020-import-export/export-fidelity.md "Ink past a text's box is kept"): an arched
// Lobster title's swash reached 10 px above its box, and the PNG cut it flat at the box plus 2 px while the SVG
// showed it whole.
import { describe, expect, it, vi } from 'vitest';
import {
  alphaInkRect,
  boundsWithInk,
  inkProbeMargin,
  inkRasterPad,
  INK_PROBE_MAX_PX,
  INK_PROBE_MIN_PX,
  measureInk,
} from './export-ink-bounds';

// An RGBA buffer with ink (alpha 255) in the given pixel rects, exclusive at the far side.
function buffer(width: number, height: number, inked: [number, number, number, number][]) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (const [x0, y0, x1, y1] of inked)
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) data[(y * width + x) * 4 + 3] = 255;
  return data;
}

// A probe canvas whose 2D context reads back `data`, as a browser's would after painting the fragment.
function probeReading(data: Uint8ClampedArray | null) {
  const ctx = {
    clearRect: vi.fn(),
    drawImage: vi.fn(),
    getImageData: vi.fn(() => ({ data })),
  };
  return { width: 0, height: 0, getContext: vi.fn(() => (data ? ctx : null)), ctx };
}

const load = vi.fn(async () => ({}) as CanvasImageSource);

describe('inkProbeMargin', () => {
  it('is one font size, clamped', () => {
    expect(inkProbeMargin(48.2)).toBe(49);
    expect(inkProbeMargin(4)).toBe(INK_PROBE_MIN_PX);
    expect(inkProbeMargin(2000)).toBe(INK_PROBE_MAX_PX);
    expect(inkProbeMargin(Number.NaN)).toBe(INK_PROBE_MIN_PX);
  });
});

describe('alphaInkRect', () => {
  it('finds the drawn pixels, and none in a blank buffer', () => {
    expect(alphaInkRect(buffer(10, 8, []), 10, 8)).toBeNull();
    expect(alphaInkRect(buffer(10, 8, [[2, 1, 5, 3]]), 10, 8)).toEqual({
      x0: 2,
      y0: 1,
      x1: 5,
      y1: 3,
    });
    // Two marks far apart: the rectangle spans both, a faint edge pixel included.
    const two = buffer(10, 8, [
      [0, 5, 1, 6],
      [8, 2, 10, 4],
    ]);
    two[(7 * 10 + 4) * 4 + 3] = 1;
    expect(alphaInkRect(two, 10, 8)).toEqual({ x0: 0, y0: 2, x1: 10, y1: 8 });
  });
});

describe('inkRasterPad', () => {
  const box = { x: 100, y: 100, width: 200, height: 60 };

  it('keeps the base pad when the ink stays within it', () => {
    expect(inkRasterPad(box, null, 2)).toBe(2);
    expect(inkRasterPad(box, { x: 101, y: 99, w: 198, h: 62 }, 2)).toBe(2);
    // A turned box's base pad already covers its sweep.
    expect(inkRasterPad(box, { x: 80, y: 90, w: 240, h: 80 }, 30)).toBe(30);
  });

  it('grows to the ink past the box on its farthest side', () => {
    // The swash rises 10.4 px above the box: the pad covers it, plus the measure's rounding pixel.
    expect(inkRasterPad(box, { x: 102, y: 89.6, w: 190, h: 70 }, 2)).toBe(12);
    // An italic leans 6 px past the right edge.
    expect(inkRasterPad(box, { x: 100, y: 100, w: 206, h: 60 }, 2)).toBe(7);
  });
});

describe('boundsWithInk', () => {
  it('takes the ink in and never shrinks', () => {
    const bounds = { x: 0, y: 0, w: 400, h: 300 };
    expect(boundsWithInk(bounds, [])).toEqual(bounds);
    expect(boundsWithInk(bounds, [{ x: 10, y: 10, w: 20, h: 20 }])).toEqual(bounds);
    expect(boundsWithInk(bounds, [{ x: 50, y: -9.5, w: 360.2, h: 40 }])).toEqual({
      x: 0,
      y: -11,
      w: 412,
      h: 311,
    });
  });
});

describe('measureInk', () => {
  // A 200 x 60 text box at (100, 100) measured with a 20 px margin: the probe is 240 x 100 px at 1x.
  const area = { x: 80, y: 80, w: 240, h: 100 };

  it('reads an overhanging text’s ink back into tab coordinates', async () => {
    // The glyphs fill the box; the swash rises 10 px above it (probe row 10 is tab y 90).
    const probe = probeReading(
      buffer(240, 100, [
        [20, 20, 220, 80],
        [30, 10, 40, 20],
      ]),
    );
    const ink = await measureInk('<svg/>', area, load, probe);
    expect([probe.width, probe.height]).toEqual([240, 100]);
    expect(probe.ctx.drawImage).toHaveBeenCalledWith({}, 0, 0, 240, 100);
    expect(ink).toEqual({ x: 100, y: 90, w: 200, h: 70 });
    // The raster grows by the swash, not by the probe's margin.
    expect(inkRasterPad({ x: 100, y: 100, width: 200, height: 60 }, ink, 2)).toBe(11);
  });

  it('answers null for no ink, no context, or a refused read', async () => {
    expect(await measureInk('<svg/>', area, load, probeReading(buffer(240, 100, [])))).toBeNull();
    expect(await measureInk('<svg/>', area, load, probeReading(null))).toBeNull();
    const tainted = probeReading(buffer(240, 100, []));
    tainted.ctx.getImageData.mockImplementation(() => {
      throw new Error('SecurityError');
    });
    expect(await measureInk('<svg/>', area, load, tainted)).toBeNull();
    const refused = vi.fn(async () => Promise.reject(new Error('load failed')));
    expect(
      await measureInk('<svg/>', area, refused, probeReading(buffer(240, 100, [[0, 0, 1, 1]]))),
    ).toBeNull();
  });
});
