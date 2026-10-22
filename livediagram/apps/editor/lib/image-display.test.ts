import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DISPLAY_CACHE_SIZE,
  DISPLAY_EDGE_DESKTOP,
  DISPLAY_EDGE_TOUCH,
  cachedDisplayCopy,
  displayCopy,
  displayEdge,
  fitWithin,
  releaseShownUrl,
  resetDisplayCacheForTests,
  shownUrl,
} from './image-display';

// docs/specs/009-elements/images.md "Shown at the size they are seen".

type Drawn = { width: number; height: number; type: string };

// A browser's decode and canvas, stubbed: the "picture" is its size, read off the blob's text.
function stubBrowser(log: string[] = []) {
  vi.stubGlobal('createImageBitmap', async (blob: Blob) => {
    const [w, h] = (await blob.text()).split('x').map(Number);
    log.push(`decode ${w}x${h}`);
    return { width: w, height: h, close: () => log.push(`close ${w}x${h}`) };
  });
  vi.stubGlobal(
    'OffscreenCanvas',
    class {
      width: number;
      height: number;
      constructor(width: number, height: number) {
        this.width = width;
        this.height = height;
      }
      getContext() {
        return { imageSmoothingQuality: 'low', drawImage: () => {} };
      }
      async convertToBlob({ type }: { type: string }) {
        const drawn: Drawn = { width: this.width, height: this.height, type };
        return new Blob([JSON.stringify(drawn)], { type });
      }
    },
  );
}

const picture = (w: number, h: number, type = 'image/png') => new Blob([`${w}x${h}`], { type });
const drawnOf = async (b: Blob): Promise<Drawn> => JSON.parse(await b.text()) as Drawn;

beforeEach(() => resetDisplayCacheForTests());
afterEach(() => vi.unstubAllGlobals());

describe('fitWithin', () => {
  it('leaves a picture that fits, and shrinks one that does not to the edge, keeping its shape', () => {
    expect(fitWithin(2048, 1000, 2048)).toBeNull();
    expect(fitWithin(3200, 2000, 2048)).toEqual({ width: 2048, height: 1280 });
    expect(fitWithin(3024, 4032, 2048)).toEqual({ width: 1536, height: 2048 });
    expect(fitWithin(100000, 1, 2048)).toEqual({ width: 2048, height: 1 });
  });
});

describe('displayEdge', () => {
  it('is smaller on a coarse pointer (a phone or tablet)', () => {
    vi.stubGlobal('window', {
      matchMedia: (q: string) => ({ matches: q === '(pointer: coarse)' }),
    });
    expect(displayEdge()).toBe(DISPLAY_EDGE_TOUCH);
    vi.stubGlobal('window', { matchMedia: () => ({ matches: false }) });
    expect(displayEdge()).toBe(DISPLAY_EDGE_DESKTOP);
  });
});

describe('displayCopy', () => {
  it('shows the original where pictures cannot be read', async () => {
    const blob = picture(5000, 5000);
    expect(await displayCopy(blob, 2048)).toBe(blob);
  });

  it('shows a GIF as it is, keeping its frames', async () => {
    stubBrowser();
    const gif = picture(5000, 5000, 'image/gif');
    expect(await displayCopy(gif, 2048)).toBe(gif);
  });

  it('shows a picture that already fits as it is, and lets the decode go', async () => {
    const log: string[] = [];
    stubBrowser(log);
    const blob = picture(1600, 1000);
    expect(await displayCopy(blob, 2048)).toBe(blob);
    expect(log).toEqual(['decode 1600x1000', 'close 1600x1000']);
  });

  it('copies a larger picture down to the edge, a photo as JPEG and anything else as PNG', async () => {
    stubBrowser();
    expect(await drawnOf(await displayCopy(picture(3200, 2000), 2048))).toEqual({
      width: 2048,
      height: 1280,
      type: 'image/png',
    });
    expect(await drawnOf(await displayCopy(picture(4032, 3024, 'image/jpeg'), 2048))).toEqual({
      width: 2048,
      height: 1536,
      type: 'image/jpeg',
    });
  });

  it('draws on a page canvas where there is no OffscreenCanvas (an older Safari), then lets it go', async () => {
    stubBrowser();
    vi.stubGlobal('OffscreenCanvas', undefined);
    const canvas = {
      width: 0,
      height: 0,
      getContext: () => ({ imageSmoothingQuality: 'low', drawImage: () => {} }),
      toBlob(done: (b: Blob | null) => void, type: string) {
        done(
          new Blob([JSON.stringify({ width: this.width, height: this.height, type })], { type }),
        );
      },
    };
    vi.stubGlobal('document', { createElement: () => canvas });
    expect(await drawnOf(await displayCopy(picture(4096, 1024), 2048))).toEqual({
      width: 2048,
      height: 512,
      type: 'image/png',
    });
    expect([canvas.width, canvas.height]).toEqual([0, 0]);
  });

  it('decodes one picture at a time', async () => {
    const log: string[] = [];
    stubBrowser(log);
    await Promise.all([
      displayCopy(picture(3000, 3000), 2048),
      displayCopy(picture(4000, 4000), 2048),
    ]);
    expect(log).toEqual([
      'decode 3000x3000',
      'close 3000x3000',
      'decode 4000x4000',
      'close 4000x4000',
    ]);
  });

  it('falls back to the original when a picture cannot be decoded', async () => {
    vi.stubGlobal('createImageBitmap', async () => {
      throw new Error('broken');
    });
    const blob = picture(3000, 3000);
    expect(await displayCopy(blob, 2048)).toBe(blob);
  });
});

describe('cachedDisplayCopy', () => {
  it('loads a picture once for every view of it at the same size', async () => {
    const load = vi.fn(async () => picture(10, 10));
    const [a, b] = await Promise.all([
      cachedDisplayCopy('img', 2048, load),
      cachedDisplayCopy('img', 2048, load),
    ]);
    expect(a).toBe(b);
    expect(load).toHaveBeenCalledTimes(1);
    await cachedDisplayCopy('img', 512, load);
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('asks again after a load found nothing', async () => {
    const load = vi.fn(async () => null);
    expect(await cachedDisplayCopy('gone', 2048, load)).toBeNull();
    await Promise.resolve();
    await cachedDisplayCopy('gone', 2048, load);
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('asks again after a load failed', async () => {
    const load = vi
      .fn<() => Promise<Blob | null>>()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValue(picture(10, 10));
    await expect(cachedDisplayCopy('flaky', 2048, load)).rejects.toThrow('offline');
    expect(await cachedDisplayCopy('flaky', 2048, load)).not.toBeNull();
  });

  it('keeps only the most recent copies', async () => {
    const load = vi.fn(async () => picture(10, 10));
    for (let i = 0; i <= DISPLAY_CACHE_SIZE; i++) await cachedDisplayCopy(`img${i}`, 2048, load);
    await cachedDisplayCopy(`img${DISPLAY_CACHE_SIZE}`, 2048, load);
    expect(load).toHaveBeenCalledTimes(DISPLAY_CACHE_SIZE + 1);
    await cachedDisplayCopy('img0', 2048, load);
    expect(load).toHaveBeenCalledTimes(DISPLAY_CACHE_SIZE + 2);
  });
});

describe('shownUrl', () => {
  it('shares one URL among the views of a copy and lets it go with the last', () => {
    let n = 0;
    const revoked: string[] = [];
    vi.spyOn(URL, 'createObjectURL').mockImplementation(() => `blob:${++n}`);
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation((u) => void revoked.push(u));
    const blob = picture(10, 10);
    const a = shownUrl(blob);
    expect(shownUrl(blob)).toBe(a);
    releaseShownUrl(a);
    expect(revoked).toEqual([]);
    releaseShownUrl(a);
    expect(revoked).toEqual([a]);
    // Shown again afterwards: a fresh URL.
    expect(shownUrl(blob)).toBe('blob:2');
    // A URL it never handed out is simply revoked.
    releaseShownUrl('blob:other');
    expect(revoked).toEqual([a, 'blob:other']);
    vi.restoreAllMocks();
  });
});
