// @vitest-environment jsdom
// The app-driven view glide: eases from one pose to the other, lands at once under reduced motion, and never runs
// backwards on a first frame stamped before the glide began.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { glideViewport } from './viewport-glide';

let frames: FrameRequestCallback[] = [];
let now = 1000;

beforeEach(() => {
  frames = [];
  now = 1000;
  vi.spyOn(performance, 'now').mockImplementation(() => now);
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => frames.push(cb));
  vi.stubGlobal('cancelAnimationFrame', () => {});
  window.matchMedia = (() => ({ matches: false })) as unknown as typeof window.matchMedia;
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  document.documentElement.classList.remove('reduce-motion');
});

const run = (at: number) => {
  const cb = frames.shift();
  cb?.(at);
};

describe('glideViewport', () => {
  const from = { zoom: 1, offset: { x: -700, y: -40 } };
  const to = { zoom: 0.8, offset: { x: 150, y: -30 } };

  it('holds the start on a frame stamped before the glide began, then eases to the end', () => {
    const zooms: number[] = [];
    const offsets: number[] = [];
    glideViewport(from, to, { zoom: (z) => zooms.push(z), offset: (o) => offsets.push(o.x) }, 240);
    // The frame began 8ms before the glide was asked for.
    run(992);
    expect(zooms[0]).toBe(1);
    expect(offsets[0]).toBe(-700);
    run(1120);
    expect(zooms[1]).toBeLessThan(1);
    expect(zooms[1]).toBeGreaterThan(0.8);
    run(1240);
    expect(zooms.at(-1)).toBe(0.8);
    expect(offsets.at(-1)).toBe(150);
    expect(frames).toHaveLength(0);
  });

  it('lands at once under reduced motion', () => {
    document.documentElement.classList.add('reduce-motion');
    const zoom = vi.fn();
    const offset = vi.fn();
    glideViewport(from, to, { zoom, offset });
    expect(zoom).toHaveBeenCalledWith(0.8);
    expect(offset).toHaveBeenCalledWith({ x: 150, y: -30 });
    expect(frames).toHaveLength(0);
  });
});
