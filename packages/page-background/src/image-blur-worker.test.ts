import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import type { BlurCopyRequest, BlurCopyResponse } from './page-image-blur-protocol';

// docs/specs/007-editor/pages-mode.md "Image backgrounds", Blur: the worker's side. Node has no OffscreenCanvas or
// createImageBitmap, so both are stood in for; the blur itself is page-image-blur.test.ts's.

const posted: BlurCopyResponse[] = [];
let onMessage: ((e: { data: BlurCopyRequest }) => void) | undefined;
const drawn: { w: number; h: number; source: unknown }[] = [];
const close = vi.fn();

class FakeOffscreenCanvas {
  width: number;
  height: number;
  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
  }
  getContext() {
    return {
      imageSmoothingQuality: 'low',
      drawImage: (source: unknown, _x: number, _y: number, w: number, h: number) =>
        drawn.push({ w, h, source }),
      getImageData: (_x: number, _y: number, w: number, h: number) => ({
        data: new Uint8ClampedArray(w * h * 4).fill(90),
      }),
      putImageData: vi.fn(),
    };
  }
  convertToBlob(opts: { type: string; quality: number }) {
    return Promise.resolve(new Blob([`${this.width}x${this.height}`], { type: opts.type }));
  }
}

let makeBlurCopy: typeof import('./page-image-blur.worker').makeBlurCopy;

beforeAll(async () => {
  vi.stubGlobal('self', {
    postMessage: (m: BlurCopyResponse) => posted.push(m),
    addEventListener: (_: 'message', fn: (e: { data: BlurCopyRequest }) => void) =>
      (onMessage = fn),
  });
  vi.stubGlobal('OffscreenCanvas', FakeOffscreenCanvas);
  vi.stubGlobal(
    'createImageBitmap',
    vi.fn(async () => ({ width: 4000, height: 3000, close })),
  );
  ({ makeBlurCopy } = await import('./page-image-blur.worker'));
});

afterEach(() => {
  posted.length = 0;
  drawn.length = 0;
  close.mockClear();
});

const page = { width: 1920, height: 1080 };

describe('the blur worker', () => {
  it('fetches, draws small, blurs and encodes a JPEG, then frees the picture', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(new Blob(['img']))),
    );
    const blob = await makeBlurCopy({ src: 'pic.jpg', page, sigma: 43.2 });
    expect(blob.type).toBe('image/jpeg');
    // The copy is drawn small (a strong blur needs few pixels): far under the picture's 4000 px.
    expect(drawn[0]!.w).toBeLessThan(400);
    expect(close).toHaveBeenCalledTimes(1);
  });

  it('answers each request by its id, and says when it cannot fetch', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (src: string) =>
        src === 'gone.jpg' ? new Response(null, { status: 404 }) : new Response(new Blob(['img'])),
      ),
    );
    onMessage!({ data: { id: 7, src: 'pic.jpg', page, sigma: 20 } });
    onMessage!({ data: { id: 8, src: 'gone.jpg', page, sigma: 20 } });
    await vi.waitFor(() => expect(posted).toHaveLength(2));
    const byId = new Map(posted.map((p) => [p.id, p]));
    expect('blob' in byId.get(7)!).toBe(true);
    expect(byId.get(8)).toEqual({ id: 8, failed: 'Error: fetch 404' });
  });

  it('frees the picture even when it has no canvas to draw on', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(new Blob(['img']))),
    );
    const getContext = vi
      .spyOn(FakeOffscreenCanvas.prototype, 'getContext')
      .mockReturnValue(null as never);
    await expect(makeBlurCopy({ src: 'pic.jpg', page, sigma: 20 })).rejects.toThrow(
      'no 2d context',
    );
    expect(close).toHaveBeenCalledTimes(1);
    getContext.mockRestore();
  });
});
