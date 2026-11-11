import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { imageDimensions, sniffImageType } from './index';

const bytes = (...parts: (number[] | string)[]) =>
  new Uint8Array(
    parts.flatMap((p) => (typeof p === 'string' ? Array.from(p, (c) => c.charCodeAt(0)) : p)),
  );
const be32 = (n: number) => [(n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff];
const be16 = (n: number) => [(n >> 8) & 0xff, n & 0xff];
const le16 = (n: number) => [n & 0xff, (n >> 8) & 0xff];
const le24 = (n: number) => [n & 0xff, (n >> 8) & 0xff, (n >> 16) & 0xff];

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const png = (w: number, h: number) =>
  bytes(PNG_SIGNATURE, be32(13), 'IHDR', be32(w), be32(h), [8, 6, 0, 0, 0]);
const riff = (chunk: string, body: number[]) =>
  bytes('RIFF', [0, 0, 0, 0], 'WEBP', chunk, [body.length, 0, 0, 0], body);

describe('imageDimensions', () => {
  it('reads a PNG IHDR', () => {
    expect(imageDimensions(png(1600, 900), 'image/png')).toEqual({ width: 1600, height: 900 });
  });

  it('refuses a PNG whose first chunk is not IHDR, or whose size is zero', () => {
    const wrong = png(10, 10);
    wrong[12] = 0x41;
    expect(imageDimensions(wrong, 'image/png')).toBeNull();
    expect(imageDimensions(png(0, 10), 'image/png')).toBeNull();
    expect(imageDimensions(png(10, 10).slice(0, 20), 'image/png')).toBeNull();
  });

  it('reads a GIF logical screen', () => {
    expect(imageDimensions(bytes('GIF89a', le16(320), le16(200)), 'image/gif')).toEqual({
      width: 320,
      height: 200,
    });
    expect(imageDimensions(bytes('GIF89a', [1]), 'image/gif')).toBeNull();
  });

  it('walks a JPEG to its first frame header, past APPn, fill bytes and RST markers', () => {
    const jpeg = bytes(
      [0xff, 0xd8],
      [0xff, 0xe0],
      be16(16),
      'JFIF',
      [0, 1, 1, 0, 0, 1, 0, 1, 0, 0],
      [0xff, 0xff],
      [0xff, 0xd0],
      [0xff, 0x01],
      [0xff, 0xc4],
      be16(4),
      [0, 0],
      [0xff, 0xc2],
      be16(17),
      [8],
      be16(480),
      be16(640),
      [3, 1, 0x22, 0, 2, 0x11, 1, 3, 0x11, 1],
    );
    expect(imageDimensions(jpeg, 'image/jpeg')).toEqual({ width: 640, height: 480 });
  });

  it('reads the phone photo the media service strips', () => {
    const photo = new Uint8Array(
      readFileSync(
        new URL(
          '../../../liveworkspace/apps/media/src/fixtures/portrait-exif.jpg',
          import.meta.url,
        ),
      ),
    );
    const size = imageDimensions(photo, sniffImageType(photo.slice(0, 16))!);
    expect(size?.width).toBeGreaterThan(0);
    expect(size?.height).toBeGreaterThan(0);
  });

  it('refuses a JPEG with no frame header, a broken marker or a bad length', () => {
    const scanFirst = bytes([0xff, 0xd8], [0xff, 0xda], be16(8), [0, 0, 0, 0, 0, 0]);
    expect(imageDimensions(scanFirst, 'image/jpeg')).toBeNull();
    expect(imageDimensions(bytes([0xff, 0xd8], [0xff, 0xd9], [0, 0]), 'image/jpeg')).toBeNull();
    expect(imageDimensions(bytes([0xff, 0xd8], [0x00, 0xe0], be16(4)), 'image/jpeg')).toBeNull();
    expect(imageDimensions(bytes([0xff, 0xd8], [0xff, 0xe0], be16(1)), 'image/jpeg')).toBeNull();
    expect(
      imageDimensions(bytes([0xff, 0xd8], [0xff, 0xc0], be16(17), [8]), 'image/jpeg'),
    ).toBeNull();
    expect(imageDimensions(bytes([0xff, 0xd8], [0xff, 0xe0], be16(2)), 'image/jpeg')).toBeNull();
  });

  it('reads each WebP header: lossy, lossless and extended', () => {
    const lossy = riff('VP8 ', [0, 0, 0, 0x9d, 0x01, 0x2a, ...le16(800), ...le16(600), 0, 0]);
    expect(imageDimensions(lossy, 'image/webp')).toEqual({ width: 800, height: 600 });
    const w = 1000 - 1;
    const h = 500 - 1;
    const bits = (w | (h << 14)) >>> 0;
    const lossless = riff('VP8L', [
      0x2f,
      bits & 0xff,
      (bits >>> 8) & 0xff,
      (bits >>> 16) & 0xff,
      (bits >>> 24) & 0xff,
      0,
      0,
      0,
      0,
      0,
    ]);
    expect(imageDimensions(lossless, 'image/webp')).toEqual({ width: 1000, height: 500 });
    const extended = riff('VP8X', [0, 0, 0, 0, ...le24(4095), ...le24(2047)]);
    expect(imageDimensions(extended, 'image/webp')).toEqual({ width: 4096, height: 2048 });
  });

  it('refuses a WebP it cannot read', () => {
    expect(imageDimensions(riff('VP8 ', [0, 0, 0]), 'image/webp')).toBeNull();
    expect(
      imageDimensions(riff('VP8 ', [0, 0, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0]), 'image/webp'),
    ).toBeNull();
    expect(imageDimensions(riff('VP8L', [0, 0, 0, 0, 0, 0, 0, 0, 0, 0]), 'image/webp')).toBeNull();
    expect(imageDimensions(riff('ALPH', [0, 0, 0, 0, 0, 0, 0, 0, 0, 0]), 'image/webp')).toBeNull();
  });
});
