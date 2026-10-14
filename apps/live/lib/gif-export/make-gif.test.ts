import { describe, expect, it, vi } from 'vitest';
import type { GifEncoderSession } from './gif-encoder';
import { GifExportError } from './gif-export-error';
import type { GifFrame } from './gif-timeline';
import { makeGif, paletteSamples } from './make-gif';
import type { PageSnapshot } from './page-snapshot';

// docs/specs/020-import-export/blueprints/animated-gif-export.md "The hook": Make.
const snap = (animated: boolean): PageSnapshot => ({
  animated,
  width: 4,
  height: 2,
  urlAt: (t) => `t=${t}`,
});

function deps(pages: PageSnapshot[], draw?: (f: GifFrame) => void) {
  const added: number[] = [];
  const palettes: number[] = [];
  const pageOf: (number | undefined)[] = [];
  const encoder: GifEncoderSession = {
    palette: (key) => void palettes.push(key),
    add: (_rgba, delayCs, palette) => {
      added.push(delayCs);
      pageOf.push(palette);
    },
    finish: vi.fn(async () => ({ bytes: new Uint8Array([1, 2, 3]), written: added.length })),
    cancel: vi.fn(),
  };
  return {
    added,
    palettes,
    pageOf,
    encoder,
    snapshot: vi.fn(async (page: number) => pages[page]!),
    drawer: {
      draw: vi.fn(async (frame: GifFrame, of: (p: number) => PageSnapshot) => {
        of(frame.page);
        draw?.(frame);
        return new Uint8ClampedArray(32);
      }),
    },
    yieldToPage: async () => {},
  };
}
const input = (over: Partial<Parameters<typeof makeGif>[0]> = {}) => ({
  pageCount: 2,
  holdSeconds: 1,
  transition: 'none' as const,
  transitionMs: 0,
  loops: true,
  signal: new AbortController().signal,
  onProgress: vi.fn(),
  ...over,
});

describe('making the GIF', () => {
  it('draws every frame in turn, with progress, and finishes the file', async () => {
    const d = deps([snap(true), snap(true)]);
    const onProgress = vi.fn();
    const { bytes, frames } = await makeGif(input({ onProgress }), d);
    expect(bytes).toEqual(new Uint8Array([1, 2, 3]));
    expect(frames).toHaveLength(30);
    expect(d.added.reduce((a, b) => a + b, 0)).toBe(200);
    expect(onProgress).toHaveBeenLastCalledWith(1);
    expect(d.snapshot).toHaveBeenCalledTimes(2);
  });

  it('gives each page one palette from its frames, and a transition frame its own', async () => {
    const d = deps([snap(true), snap(true)]);
    const { frames } = await makeGif(input({ transition: 'fade', transitionMs: 380 }), d);
    expect(d.palettes).toEqual([0, 1]);
    frames.forEach((f, i) => expect(d.pageOf[i]).toBe(f.from ? undefined : f.page));
    expect(d.pageOf).toContain(undefined);
  });

  it('samples a page’s palette from its first, middle and last frames', () => {
    const own = (t: number) => ({ page: 0, t, mix: 1, delayCs: 7 });
    const frames = [own(0), own(1), own(2), own(3), own(4), { ...own(5), page: 1 }];
    expect(paletteSamples(frames, 0).map((f) => f.t)).toEqual([0, 2, 4]);
    expect(paletteSamples(frames.slice(0, 2), 0)).toHaveLength(2);
  });

  it('draws a still page once', async () => {
    const d = deps([snap(false), snap(true)]);
    const { frames } = await makeGif(input(), d);
    expect(frames.filter((f) => f.page === 0)).toHaveLength(1);
    expect(d.added[0]).toBe(100);
  });

  it('stops between frames when cancelled, ending the encoder', async () => {
    const controller = new AbortController();
    let drawn = 0;
    const d = deps([snap(true), snap(true)], () => {
      drawn += 1;
      if (drawn === 3) controller.abort();
    });
    await expect(makeGif(input({ signal: controller.signal }), d)).rejects.toMatchObject({
      name: 'AbortError',
    });
    expect(drawn).toBe(3);
    expect(d.encoder.cancel).toHaveBeenCalled();
    expect(d.encoder.finish).not.toHaveBeenCalled();
  });

  it('discards the file when cancelled while it is being finished', async () => {
    const controller = new AbortController();
    const d = deps([snap(true), snap(true)]);
    d.encoder.finish = vi.fn(async () => {
      controller.abort();
      return { bytes: new Uint8Array([1]), written: 1 };
    });
    await expect(makeGif(input({ signal: controller.signal }), d)).rejects.toMatchObject({
      name: 'AbortError',
    });
  });

  it('passes an export error on as it is, and anything else as failed', async () => {
    const tainted = deps([snap(true), snap(true)], () => {
      throw new GifExportError('tainted');
    });
    await expect(makeGif(input(), tainted)).rejects.toEqual(new GifExportError('tainted'));
    expect(tainted.encoder.cancel).toHaveBeenCalled();
    const broken = deps([snap(true), snap(true)], () => {
      throw new RangeError('out of memory');
    });
    await expect(makeGif(input(), broken)).rejects.toEqual(new GifExportError('failed'));
  });
});
