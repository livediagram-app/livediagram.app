// @vitest-environment jsdom
// docs/specs/009-elements/picture-crop-and-mask.md "Export and preview": the PNG and PDF exports' picture painter.

import { afterEach, describe, expect, it, vi } from 'vitest';
import { drawPictureOnCanvas, type CanvasPicture } from './image-canvas-draw';

type Call = [string, ...unknown[]];

// A 2D context that records its calls; `filters` says whether it keeps a CSS filter written to it.
function recorder(filters = true) {
  const calls: Call[] = [];
  const state: Record<string, unknown> = { filter: 'none', fillStyle: '' };
  const ctx = new Proxy(state, {
    get(t, k: string) {
      if (k in t) return t[k];
      return (...args: unknown[]) => calls.push([k, ...args]);
    },
    set(t, k: string, v) {
      if (k === 'filter' && !filters) return true;
      t[k] = v;
      return true;
    },
  });
  return { ctx: ctx as unknown as CanvasRenderingContext2D, calls, state };
}

const img = (w: number, h: number) =>
  ({ naturalWidth: w, naturalHeight: h, width: w, height: h }) as HTMLImageElement;
const pic = (over: Partial<CanvasPicture> = {}): CanvasPicture => ({
  type: 'image',
  x: 10,
  y: 20,
  width: 200,
  height: 100,
  ...over,
});
const drawn = (calls: Call[]) => calls.find((c) => c[0] === 'drawImage')!;

afterEach(() => vi.unstubAllGlobals());

describe('drawPictureOnCanvas', () => {
  it('clips to the rounded box on white and fits the picture by its fit', () => {
    const { ctx, calls, state } = recorder();
    drawPictureOnCanvas(ctx, pic(), img(100, 100), 'contain', 12);
    expect(calls.filter((c) => c[0] === 'arcTo')).toHaveLength(4);
    expect(calls.some((c) => c[0] === 'clip' && c.length === 1)).toBe(true);
    expect(state.fillStyle).toBe('#ffffff');
    // A square picture contained in 200 x 100: 100 x 100, centred.
    expect(drawn(calls).slice(2)).toEqual([60, 20, 100, 100]);
    const { ctx: c2, calls: k2 } = recorder();
    drawPictureOnCanvas(c2, pic(), img(100, 100), 'cover', 0);
    expect(drawn(k2).slice(2)).toEqual([10, -30, 200, 200]);
    expect(k2.at(-1)![0]).toBe('restore');
  });

  it('clips a masked picture to its path, covering it', () => {
    const paths: string[] = [];
    vi.stubGlobal(
      'Path2D',
      class {
        constructor(d: string) {
          paths.push(d);
        }
      },
    );
    const { ctx, calls } = recorder();
    drawPictureOnCanvas(ctx, pic({ mask: 'diamond' }), img(400, 200), 'cover', 8);
    expect(paths[0]).toBe('M110 20L210 70L110 120L10 70Z');
    expect(calls.some((c) => c[0] === 'arcTo')).toBe(false);
    // Shaped: the kept part clipped, then the picture laid out at its scale.
    expect(calls.some((c) => c[0] === 'rect')).toBe(true);
    expect(drawn(calls).slice(2)).toEqual([10, 20, 200, 100]);
  });

  it('lays a crop out inside its part', () => {
    const { ctx, calls } = recorder();
    drawPictureOnCanvas(
      ctx,
      pic({ crop: { x: 0.5, y: 0, width: 0.5, height: 1 } }),
      img(400, 100),
      'contain',
      0,
    );
    // The right half (200 x 100) fills the box; the whole picture is 400 wide, shifted left by half.
    expect(drawn(calls).slice(2)).toEqual([-190, 20, 400, 100]);
  });

  it('greys by the canvas filter, else by a grey copy', () => {
    const { ctx, state } = recorder(true);
    drawPictureOnCanvas(ctx, pic({ greyscale: true }), img(10, 10), 'contain', 0);
    expect(state.filter).toBe('grayscale(1)');
    // No filter support and a picture that cannot be copied (no 2D context in jsdom): the picture as it is.
    const plain = img(10, 10);
    const { ctx: c2, calls } = recorder(false);
    drawPictureOnCanvas(c2, pic({ greyscale: true }), plain, 'contain', 0);
    expect(drawn(calls)[1]).toBe(plain);
  });

  it('paints only the white for a picture with no size, and reads no picture fields off other kinds', () => {
    const { ctx, calls } = recorder();
    drawPictureOnCanvas(ctx, pic(), img(0, 0), 'contain', 0);
    expect(calls.some((c) => c[0] === 'drawImage')).toBe(false);
    expect(calls.some((c) => c[0] === 'fillRect')).toBe(true);
    const { ctx: c2, calls: k2 } = recorder();
    drawPictureOnCanvas(c2, pic({ type: 'shape', mask: 'circle' }), img(100, 100), 'contain', 0);
    expect(k2.some((c) => c[0] === 'arcTo')).toBe(true);
  });
});
