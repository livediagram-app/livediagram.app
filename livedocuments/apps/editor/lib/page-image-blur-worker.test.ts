// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { BlurCopyRequest, BlurCopyResponse } from './page-image-blur-protocol';
import {
  BLUR_CACHE_SIZE,
  acquireBlurredImage,
  clearBlurCache,
  type BlurWorkerLike,
} from './page-image-blur';

// docs/specs/007-editor/pages-mode.md "Image backgrounds", Blur: the copy is made in a worker, the page making it
// itself only where the worker cannot.

type Listener = (e: { data: BlurCopyResponse }) => void;

function fakeWorker() {
  const sent: BlurCopyRequest[] = [];
  const on: { message?: Listener; error?: () => void } = {};
  const terminate = vi.fn();
  const w: BlurWorkerLike = {
    postMessage: (m) => sent.push(m),
    addEventListener: ((type: 'message' | 'error', fn: Listener | (() => void)) => {
      if (type === 'message') on.message = fn;
      else on.error = fn as () => void;
    }) as BlurWorkerLike['addEventListener'],
    terminate,
  };
  return {
    w,
    sent,
    terminate,
    reply: (data: BlurCopyResponse) => on.message!({ data }),
    fail: () => on.error!(),
  };
}

const page = { width: 1920, height: 1080 };
const tick = () => new Promise((r) => setTimeout(r, 0));
let urls = 0;
const revoked: string[] = [];

// jsdom decodes nothing: each test says how its picture decodes.
HTMLImageElement.prototype.decode ??= () => Promise.reject(new Error('no decoder'));

beforeEach(() => {
  urls = 0;
  revoked.length = 0;
  URL.createObjectURL = vi.fn(() => `blob:copy-${++urls}`);
  URL.revokeObjectURL = vi.fn((u: string) => void revoked.push(u));
});
afterEach(() => {
  clearBlurCache(undefined);
  vi.restoreAllMocks();
});

describe('the blurred copy', () => {
  it('is made in the worker and handed back as a blob URL', async () => {
    const fake = fakeWorker();
    clearBlurCache(() => fake.w);
    const held = acquireBlurredImage('pic.jpg', page, 20);
    await tick();
    expect(fake.sent).toEqual([{ id: expect.any(Number), src: 'pic.jpg', page, sigma: 20 }]);
    fake.reply({ id: fake.sent[0]!.id, blob: new Blob(['x']) });
    await expect(held.url).resolves.toBe('blob:copy-1');
    held.release();
  });

  it('is asked for once per picture, page and strength, and made one at a time', async () => {
    const fake = fakeWorker();
    clearBlurCache(() => fake.w);
    const a = acquireBlurredImage('pic.jpg', page, 20);
    const b = acquireBlurredImage('pic.jpg', page, 20);
    const c = acquireBlurredImage('pic.jpg', page, 30);
    expect(b.url).toBe(a.url);
    await tick();
    // The second strength waits for the first copy.
    expect(fake.sent).toHaveLength(1);
    fake.reply({ id: fake.sent[0]!.id, blob: new Blob(['x']) });
    await a.url;
    await tick();
    expect(fake.sent).toHaveLength(2);
    fake.reply({ id: fake.sent[1]!.id, blob: new Blob(['y']) });
    await expect(c.url).resolves.toBe('blob:copy-2');
    // A stray reply is ignored.
    fake.reply({ id: 999, blob: new Blob(['z']) });
  });

  it(`keeps the last ${BLUR_CACHE_SIZE} copies no sheet shows`, async () => {
    const fake = fakeWorker();
    clearBlurCache(() => fake.w);
    const made: Promise<string | null>[] = [];
    for (let i = 0; i <= BLUR_CACHE_SIZE; i++) {
      const held = acquireBlurredImage(`pic-${i}.jpg`, page, 20);
      await tick();
      fake.reply({ id: fake.sent.at(-1)!.id, blob: new Blob([String(i)]) });
      made.push(held.url);
      await held.url;
      held.release();
    }
    await tick();
    // The oldest went, its URL given back; the rest are kept.
    expect(revoked).toEqual([await made[0]]);
    const again = acquireBlurredImage('pic-1.jpg', page, 20);
    expect(again.url).toBe(made[1]);
  });

  it('starts the module worker where the browser has OffscreenCanvas', async () => {
    const started: { url: string; type: string }[] = [];
    const fake = fakeWorker();
    vi.stubGlobal(
      'Worker',
      class {
        constructor(url: URL, opts: { type: string }) {
          started.push({ url: String(url), type: opts.type });
          return fake.w;
        }
      },
    );
    vi.stubGlobal('OffscreenCanvas', class {});
    vi.stubGlobal('createImageBitmap', vi.fn());
    try {
      clearBlurCache(undefined);
      acquireBlurredImage('pic.jpg', page, 20);
      await tick();
      expect(started).toEqual([
        { url: expect.stringContaining('page-image-blur.worker'), type: 'module' },
      ]);
      expect(fake.sent).toHaveLength(1);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('is made on the page when the worker cannot read the picture', async () => {
    const fake = fakeWorker();
    clearBlurCache(() => fake.w);
    const decode = vi
      .spyOn(HTMLImageElement.prototype, 'decode')
      .mockRejectedValue(new Error('not here'));
    const held = acquireBlurredImage('far.jpg', page, 20);
    await tick();
    fake.reply({ id: fake.sent[0]!.id, failed: 'TypeError: fetch failed' });
    await expect(held.url).resolves.toBeNull();
    expect(decode).toHaveBeenCalledTimes(1);
  });

  it('gives the worker up when it fails to load, and makes every copy on the page', async () => {
    const fake = fakeWorker();
    const create = vi.fn(() => fake.w);
    clearBlurCache(create);
    const decode = vi
      .spyOn(HTMLImageElement.prototype, 'decode')
      .mockRejectedValue(new Error('not here'));
    const first = acquireBlurredImage('a.jpg', page, 20);
    await tick();
    fake.fail();
    await expect(first.url).resolves.toBeNull();
    expect(fake.terminate).toHaveBeenCalled();
    const second = acquireBlurredImage('b.jpg', page, 20);
    await expect(second.url).resolves.toBeNull();
    expect(create).toHaveBeenCalledTimes(1);
    expect(fake.sent).toHaveLength(1);
    expect(decode).toHaveBeenCalledTimes(2);
  });

  it('makes the copy on the page where no worker starts', async () => {
    clearBlurCache(() => {
      throw new Error('blocked');
    });
    const draw = vi.fn();
    const ctx = {
      drawImage: draw,
      getImageData: (_x: number, _y: number, w: number, h: number) => ({
        data: new Uint8ClampedArray(w * h * 4),
      }),
      putImageData: vi.fn(),
    };
    vi.spyOn(HTMLImageElement.prototype, 'decode').mockResolvedValue(undefined);
    vi.spyOn(HTMLImageElement.prototype, 'naturalWidth', 'get').mockReturnValue(400);
    vi.spyOn(HTMLImageElement.prototype, 'naturalHeight', 'get').mockReturnValue(300);
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
      ctx as unknown as CanvasRenderingContext2D,
    );
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((done) =>
      done(new Blob(['j'])),
    );
    const held = acquireBlurredImage('here.jpg', page, 20);
    await expect(held.url).resolves.toBe('blob:copy-1');
    expect(draw).toHaveBeenCalledTimes(1);
  });

  it('is null on the page when the canvas gives no context', async () => {
    clearBlurCache(null);
    vi.spyOn(HTMLImageElement.prototype, 'decode').mockResolvedValue(undefined);
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    await expect(acquireBlurredImage('x.jpg', page, 20).url).resolves.toBeNull();
  });

  it('is null on the page when the JPEG cannot be made', async () => {
    clearBlurCache(null);
    vi.spyOn(HTMLImageElement.prototype, 'decode').mockResolvedValue(undefined);
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      drawImage: vi.fn(),
      getImageData: (_x: number, _y: number, w: number, h: number) => ({
        data: new Uint8ClampedArray(w * h * 4),
      }),
      putImageData: vi.fn(),
    } as unknown as CanvasRenderingContext2D);
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((done) => done(null));
    await expect(acquireBlurredImage('y.jpg', page, 20).url).resolves.toBeNull();
  });
});
