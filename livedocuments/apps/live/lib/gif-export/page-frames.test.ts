import { afterEach, describe, expect, it, vi } from 'vitest';
import { GifExportError } from './gif-export-error';
import { composeFrame, createFrameDrawer, loadSvg, type FrameContext } from './page-frames';

// docs/specs/020-import-export/blueprints/animated-gif-export.md "Frames".
function fakeContext() {
  const calls: string[] = [];
  const ctx = {
    fillStyle: '',
    globalAlpha: 1,
    fillRect: (x: number, y: number, w: number, h: number) =>
      calls.push(`fill ${String(ctx.fillStyle)} ${x},${y} ${w}x${h}`),
    drawImage: (img: unknown, x: number, y: number) =>
      calls.push(`draw ${String(img)} ${x},${y} a=${ctx.globalAlpha}`),
  };
  return { ctx: ctx as unknown as FrameContext, calls };
}
const IN = 'in' as unknown as CanvasImageSource;
const OUT = 'out' as unknown as CanvasImageSource;
const under = { page: 1, t: 67, from: { page: 0, t: 3067 }, mix: 0.25, delayCs: 7 };

describe('composing a frame', () => {
  it('lays white paper under a page, for a logo page’s see-through paper', () => {
    const { ctx, calls } = fakeContext();
    composeFrame(ctx, { page: 0, t: 0, mix: 1, delayCs: 7 }, 'fade', 100, 50, { incoming: IN });
    expect(calls).toEqual(['fill #ffffff 0,0 100x50', 'draw in 0,0 a=1']);
  });

  it('fades the incoming page in over the outgoing one', () => {
    const { ctx, calls } = fakeContext();
    composeFrame(ctx, under, 'fade', 100, 50, { incoming: IN, outgoing: OUT });
    expect(calls.slice(1)).toEqual(['draw out 0,0 a=1', 'draw in 0,0 a=0.25']);
    expect(ctx.globalAlpha).toBe(1);
  });

  it('slides the outgoing page out left as the incoming one comes in from the right', () => {
    const { ctx, calls } = fakeContext();
    composeFrame(ctx, under, 'slide', 100, 50, { incoming: IN, outgoing: OUT });
    expect(calls.slice(1)).toEqual(['draw out -25,0 a=1', 'draw in 75,0 a=1']);
  });

  it('cuts with no transition', () => {
    const { ctx, calls } = fakeContext();
    composeFrame(ctx, under, 'none', 100, 50, { incoming: IN, outgoing: OUT });
    expect(calls.slice(1)).toEqual(['draw in 0,0 a=1']);
  });
});

describe('the frame drawer', () => {
  const frame = { page: 0, t: 0, mix: 1, delayCs: 7 };
  const snapshot = { animated: false, width: 4, height: 2, urlAt: (t: number) => `data:${t}` };

  function fakeDoc(ctx: Partial<CanvasRenderingContext2D> | null) {
    return {
      createElement: () => ({ width: 0, height: 0, getContext: () => ctx }),
    } as unknown as Document;
  }
  function stubImage(decode: () => Promise<void>) {
    const srcs: string[] = [];
    vi.stubGlobal(
      'Image',
      class {
        decoding = '';
        set src(v: string) {
          srcs.push(v);
        }
        decode = decode;
      },
    );
    return srcs;
  }
  afterEach(() => vi.unstubAllGlobals());

  it('draws the page at its moment and reads the frame back', async () => {
    const srcs = stubImage(async () => {});
    const data = new Uint8ClampedArray(32);
    const ctx = {
      ...fakeContext().ctx,
      getImageData: () => ({ data }),
    } as unknown as CanvasRenderingContext2D;
    const drawer = createFrameDrawer(4, 2, 'fade', fakeDoc(ctx));
    await expect(drawer.draw({ ...frame, t: 500 }, () => snapshot)).resolves.toBe(data);
    expect(srcs).toEqual(['data:500']);
  });

  it('loads the outgoing page too under a transition', async () => {
    const srcs = stubImage(async () => {});
    const ctx = { ...fakeContext().ctx, getImageData: () => ({ data: new Uint8ClampedArray(32) }) };
    const drawer = createFrameDrawer(
      4,
      2,
      'fade',
      fakeDoc(ctx as unknown as CanvasRenderingContext2D),
    );
    await drawer.draw({ ...frame, t: 67, from: { page: 1, t: 3067 }, mix: 0.2 }, () => snapshot);
    expect(srcs).toEqual(['data:67', 'data:3067']);
  });

  it('fails as tainted when the browser will not hand the pixels back', async () => {
    stubImage(async () => {});
    const ctx = {
      ...fakeContext().ctx,
      getImageData: () => {
        throw new DOMException('tainted', 'SecurityError');
      },
    };
    const drawer = createFrameDrawer(4, 2, 'none', fakeDoc(ctx));
    await expect(drawer.draw(frame, () => snapshot)).rejects.toEqual(new GifExportError('tainted'));
  });

  it('fails when a page will not decode, or there is no canvas to draw on', async () => {
    stubImage(() => Promise.reject(new Error('decode')));
    await expect(loadSvg('data:x')).rejects.toEqual(new GifExportError('failed'));
    expect(() => createFrameDrawer(4, 2, 'none', fakeDoc(null))).toThrow(GifExportError);
  });
});
