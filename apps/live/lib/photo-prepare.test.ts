// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PHOTO_MAX_EDGE_PX } from '@livediagram/api-schema';
import { photoTypeError, preparePhoto, PhotoPrepareFailed } from './photo-prepare';

// Preparing a photo before it leaves the browser (spec/139 Phase 8). jsdom has
// no canvas encoder, so the drawing surface is stubbed — what is under test is
// the DECISIONS (what is rejected, what size is chosen, that the orientation
// flag is honoured), not Chromium's JPEG writer.

type Stub = { width: number; height: number };

function stubImaging(bitmap: Stub | 'throw') {
  const drawImage = vi.fn();
  const created: ImageBitmapOptions[] = [];
  vi.stubGlobal(
    'createImageBitmap',
    vi.fn(async (_file: Blob, opts?: ImageBitmapOptions) => {
      created.push(opts ?? {});
      if (bitmap === 'throw') throw new Error('decode failed');
      return { ...bitmap, close: vi.fn() } as unknown as ImageBitmap;
    }),
  );
  const canvas = { width: 0, height: 0 } as HTMLCanvasElement & { width: number; height: number };
  vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
    if (tag !== 'canvas') return document.createElementNS('http://www.w3.org/1999/xhtml', tag);
    Object.assign(canvas, {
      getContext: () => ({ drawImage }),
      toDataURL: () => `data:image/jpeg;base64,${'A'.repeat(64)}`,
    });
    return canvas;
  });
  return { canvas, created, drawImage };
}

const file = (type = 'image/jpeg') => new File([new Uint8Array([1, 2, 3])], 'wall.jpg', { type });

beforeEach(() => vi.restoreAllMocks());
afterEach(() => vi.unstubAllGlobals());

describe('photoTypeError', () => {
  it('accepts the three formats the wire contract accepts', () => {
    for (const type of ['image/jpeg', 'image/png', 'image/webp']) {
      expect(photoTypeError(type), type).toBeNull();
    }
  });

  it('calls out HEIC by name — it is the iPhone default and the advice differs', () => {
    expect(photoTypeError('image/heic')).toBe('photo_unsupported_heic');
    expect(photoTypeError('image/heif')).toBe('photo_unsupported_heic');
  });

  it('refuses everything else, GIF and SVG included', () => {
    expect(photoTypeError('image/gif')).toBe('photo_unsupported_type');
    expect(photoTypeError('image/svg+xml')).toBe('photo_unsupported_type');
    expect(photoTypeError('application/pdf')).toBe('photo_unsupported_type');
  });
});

describe('preparePhoto', () => {
  it('refuses a HEIC before touching the decoder', async () => {
    const { created } = stubImaging({ width: 100, height: 100 });
    await expect(preparePhoto(file('image/heic'))).rejects.toMatchObject({
      reason: 'photo_unsupported_heic',
    });
    expect(created).toHaveLength(0);
  });

  it('honours the EXIF orientation flag, so a phone photo arrives upright', async () => {
    const { created } = stubImaging({ width: 800, height: 600 });
    await preparePhoto(file());
    expect(created[0]).toEqual({ imageOrientation: 'from-image' });
  });

  it('downscales to the long edge, keeping the aspect', async () => {
    const { canvas } = stubImaging({ width: 4000, height: 3000 });
    const out = await preparePhoto(file());
    expect(out.width).toBe(PHOTO_MAX_EDGE_PX);
    expect(out.height).toBe(Math.round((PHOTO_MAX_EDGE_PX * 3000) / 4000));
    expect(canvas.width).toBe(out.width);
  });

  it('downscales a PORTRAIT photo by its own long edge', async () => {
    stubImaging({ width: 3000, height: 4000 });
    const out = await preparePhoto(file());
    expect(out.height).toBe(PHOTO_MAX_EDGE_PX);
    expect(out.width).toBe(Math.round((PHOTO_MAX_EDGE_PX * 3000) / 4000));
  });

  it('never upscales a small photo', async () => {
    stubImaging({ width: 640, height: 480 });
    const out = await preparePhoto(file());
    expect(out).toMatchObject({ width: 640, height: 480 });
  });

  it('re-encodes as JPEG, which is what drops the metadata', async () => {
    stubImaging({ width: 100, height: 100 });
    const out = await preparePhoto(file('image/png'));
    expect(out.dataUrl.startsWith('data:image/jpeg;base64,')).toBe(true);
  });

  it('reports an undecodable file rather than throwing something raw', async () => {
    stubImaging('throw');
    await expect(preparePhoto(file())).rejects.toBeInstanceOf(PhotoPrepareFailed);
    await expect(preparePhoto(file())).rejects.toMatchObject({ reason: 'photo_unreadable' });
  });

  it('refuses a photo that is still too big AFTER the re-encode', async () => {
    stubImaging({ width: 100, height: 100 });
    vi.spyOn(document, 'createElement').mockImplementation(
      () =>
        ({
          width: 0,
          height: 0,
          getContext: () => ({ drawImage: vi.fn() }),
          // Bigger than the cap once decoded.
          toDataURL: () => `data:image/jpeg;base64,${'A'.repeat(12 * 1024 * 1024)}`,
        }) as unknown as HTMLElement,
    );
    await expect(preparePhoto(file())).rejects.toMatchObject({ reason: 'photo_too_large' });
  });
});
