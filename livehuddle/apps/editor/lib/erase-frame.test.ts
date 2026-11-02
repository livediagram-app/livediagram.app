import { describe, expect, it, vi } from 'vitest';
import { createEraseFrameReader } from './erase-frame';

// docs/specs/023-draw-mode/draw-mode.md "Eraser": the brush stays under the pointer through a pan
// or zoom mid-sweep.

describe('createEraseFrameReader', () => {
  it('reads the rect once while the view holds still', () => {
    const view = { offset: { x: 0, y: 0 }, zoom: 1 };
    const rect = vi.fn(() => ({ left: 10, top: 20 }));
    const read = createEraseFrameReader(() => view, rect);
    expect(read()).toEqual({ left: 10, top: 20, zoom: 1 });
    for (let i = 0; i < 50; i++) read();
    expect(rect).toHaveBeenCalledTimes(1);
  });

  it('re-reads the rect and the zoom once the view pans or zooms', () => {
    let view = { offset: { x: 0, y: 0 }, zoom: 1 };
    let at = { left: 10, top: 20 };
    const rect = vi.fn(() => at);
    const read = createEraseFrameReader(() => view, rect);
    read();
    view = { offset: { x: 40, y: 0 }, zoom: 1 };
    at = { left: 50, top: 20 };
    expect(read()).toEqual({ left: 50, top: 20, zoom: 1 });
    view = { offset: { x: 40, y: 0 }, zoom: 2 };
    at = { left: 30, top: 0 };
    expect(read()).toEqual({ left: 30, top: 0, zoom: 2 });
    expect(rect).toHaveBeenCalledTimes(3);
  });

  it('keeps the last frame when the canvas is gone, and is null before it was ever seen', () => {
    let el: { left: number; top: number } | null = null;
    let view = { offset: { x: 0, y: 0 }, zoom: 1 };
    const read = createEraseFrameReader(
      () => view,
      () => el,
    );
    expect(read()).toBeNull();
    el = { left: 1, top: 2 };
    expect(read()).toEqual({ left: 1, top: 2, zoom: 1 });
    el = null;
    view = { offset: { x: 5, y: 5 }, zoom: 1 };
    expect(read()).toEqual({ left: 1, top: 2, zoom: 1 });
  });
});
