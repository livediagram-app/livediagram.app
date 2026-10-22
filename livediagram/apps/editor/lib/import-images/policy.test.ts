import { describe, expect, it } from 'vitest';
import { MAX_IMAGE_BYTES } from '@livediagram/api-schema';
import { fallbackOutputType, planImageEncoding } from './policy';

const MB = 1024 * 1024;

describe('planImageEncoding', () => {
  it('scales a large PNG down so its longest side is 2048, keeping the aspect', () => {
    expect(
      planImageEncoding({ mimeType: 'image/png', width: 4096, height: 1024, byteLength: 3 * MB }),
    ).toEqual({ action: 'encode', width: 2048, height: 512, keepIfSmaller: false });
  });

  it('scales on the taller side too', () => {
    expect(
      planImageEncoding({ mimeType: 'image/jpeg', width: 1000, height: 3000, byteLength: MB }),
    ).toEqual({ action: 'encode', width: 683, height: 2048, keepIfSmaller: false });
  });

  it('re-encodes a PNG that fits at the same size and keeps the original if it is smaller', () => {
    expect(
      planImageEncoding({ mimeType: 'image/png', width: 800, height: 600, byteLength: 200_000 }),
    ).toEqual({ action: 'encode', width: 800, height: 600, keepIfSmaller: true });
  });

  it('never scales a small image up', () => {
    expect(
      planImageEncoding({ mimeType: 'image/jpeg', width: 10, height: 20, byteLength: 500 }),
    ).toEqual({ action: 'encode', width: 10, height: 20, keepIfSmaller: true });
  });

  it('keeps a WebP that fits', () => {
    expect(
      planImageEncoding({ mimeType: 'image/webp', width: 2048, height: 2048, byteLength: MB }),
    ).toEqual({ action: 'keep' });
  });

  it('re-encodes a WebP that is too wide', () => {
    expect(
      planImageEncoding({ mimeType: 'image/webp', width: 4000, height: 2000, byteLength: MB }),
    ).toEqual({ action: 'encode', width: 2048, height: 1024, keepIfSmaller: false });
  });

  it('keeps a GIF that fits so its animation survives', () => {
    expect(
      planImageEncoding({ mimeType: 'image/gif', width: 480, height: 270, byteLength: 4 * MB }),
    ).toEqual({ action: 'keep' });
  });

  it('flattens a GIF over the per-file cap', () => {
    expect(
      planImageEncoding({
        mimeType: 'image/gif',
        width: 480,
        height: 270,
        byteLength: MAX_IMAGE_BYTES + 1,
      }),
    ).toEqual({ action: 'encode', width: 480, height: 270, keepIfSmaller: false });
  });

  it('flattens and scales a GIF that is too large', () => {
    expect(
      planImageEncoding({ mimeType: 'image/gif', width: 4096, height: 4096, byteLength: MB }),
    ).toEqual({ action: 'encode', width: 2048, height: 2048, keepIfSmaller: false });
  });

  it('re-encodes a format the gallery refuses, such as BMP', () => {
    expect(
      planImageEncoding({ mimeType: 'image/bmp', width: 100, height: 50, byteLength: 20_000 }),
    ).toEqual({ action: 'encode', width: 100, height: 50, keepIfSmaller: false });
  });

  describe('SVG', () => {
    it('rasterises at twice its intrinsic size', () => {
      expect(
        planImageEncoding({ mimeType: 'image/svg+xml', width: 300, height: 150, byteLength: 900 }),
      ).toEqual({ action: 'encode', width: 600, height: 300, keepIfSmaller: false });
    });

    it('uses the display hint when it is larger than the intrinsic size', () => {
      expect(
        planImageEncoding({
          mimeType: 'image/svg+xml',
          width: 100,
          height: 50,
          byteLength: 900,
          hint: { width: 400, height: 200 },
        }),
      ).toEqual({ action: 'encode', width: 800, height: 400, keepIfSmaller: false });
    });

    it('caps the raster at 2048', () => {
      expect(
        planImageEncoding({ mimeType: 'image/svg+xml', width: 1600, height: 800, byteLength: 900 }),
      ).toEqual({ action: 'encode', width: 2048, height: 1024, keepIfSmaller: false });
    });

    it('takes the aspect from the hint when the SVG has no intrinsic size', () => {
      expect(
        planImageEncoding({
          mimeType: 'image/svg+xml',
          width: 0,
          height: 0,
          byteLength: 900,
          hint: { width: 200, height: 100 },
        }),
      ).toEqual({ action: 'encode', width: 400, height: 200, keepIfSmaller: false });
    });

    it('falls back to a 1024 square when nothing is known', () => {
      expect(
        planImageEncoding({ mimeType: 'image/svg+xml', width: 0, height: 0, byteLength: 900 }),
      ).toEqual({ action: 'encode', width: 1024, height: 1024, keepIfSmaller: false });
    });
  });
});

describe('fallbackOutputType', () => {
  it('keeps JPEG for a JPEG source', () => {
    expect(fallbackOutputType('image/jpeg')).toBe('image/jpeg');
  });

  it('uses PNG for everything else', () => {
    expect(fallbackOutputType('image/png')).toBe('image/png');
    expect(fallbackOutputType('image/svg+xml')).toBe('image/png');
    expect(fallbackOutputType('image/gif')).toBe('image/png');
  });
});
