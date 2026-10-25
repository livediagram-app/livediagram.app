import { describe, expect, it } from 'vitest';
import { imagePixelSize } from './image-size';

// The header sizes the image embedder budgets pixels by (docs/specs/015-api/mcp-server.md §5 "Picture budget"): one
// case per accepted format, and the headers it must refuse rather than guess.

const bytes = (...parts: (number | string)[]) =>
  new Uint8Array(
    parts.flatMap((p) => (typeof p === 'string' ? [...p].map((c) => c.charCodeAt(0)) : [p])),
  );
const be32 = (n: number) => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
const le16 = (n: number) => [n & 255, (n >>> 8) & 255];
const le24 = (n: number) => [n & 255, (n >>> 8) & 255, (n >>> 16) & 255];

const png = (w: number, h: number) =>
  bytes(0x89, 'PNG', 0x0d, 0x0a, 0x1a, 0x0a, ...be32(13), 'IHDR', ...be32(w), ...be32(h), 8, 6);
const riff = (chunk: string, body: number[]) =>
  bytes(
    'RIFF',
    ...be32(0),
    'WEBP',
    chunk,
    ...be32(0),
    ...body,
    ...Array.from({ length: 8 }, () => 0),
  );

describe('imagePixelSize', () => {
  it('reads a PNG from its IHDR', () => {
    expect(imagePixelSize(png(2880, 1800))).toEqual({ width: 2880, height: 1800 });
  });

  it('reads a GIF from its logical screen', () => {
    expect(imagePixelSize(bytes('GIF89a', ...le16(640), ...le16(480), 0, 0))).toEqual({
      width: 640,
      height: 480,
    });
  });

  it('reads a JPEG from its frame, past the segments before it and fill bytes', () => {
    const app0 = [0xff, 0xe0, 0, 6, 0, 0, 0, 0];
    const sof2 = [0xff, 0xff, 0xc2, 0, 11, 8, ...[0x03, 0x84], ...[0x05, 0x00], 3, 0, 0];
    expect(imagePixelSize(bytes(0xff, 0xd8, ...app0, ...sof2))).toEqual({
      width: 1280,
      height: 900,
    });
  });

  it('steps over markers that carry no length: restart markers and TEM', () => {
    const sof0 = [0xff, 0xc0, 0, 11, 8, 0, 10, 0, 20, 3, 0, 0];
    expect(imagePixelSize(bytes(0xff, 0xd8, 0xff, 0xd0, 0xff, 0x01, ...sof0))).toEqual({
      width: 20,
      height: 10,
    });
  });

  it('does not read a Huffman table segment (C4) as a frame', () => {
    const dht = [0xff, 0xc4, 0, 6, 0x09, 0x09, 0x09, 0x09];
    const sof0 = [0xff, 0xc0, 0, 11, 8, 0, 10, 0, 20, 3, 0, 0];
    expect(imagePixelSize(bytes(0xff, 0xd8, ...dht, ...sof0))).toEqual({ width: 20, height: 10 });
  });

  it('reads each WebP flavour: lossy, lossless and extended', () => {
    const lossy = [0, 0, 0, 0x9d, 0x01, 0x2a, ...le16(1024), ...le16(768)];
    expect(imagePixelSize(riff('VP8 ', lossy))).toEqual({ width: 1024, height: 768 });
    // Lossless packs width-1 and height-1 into 14 bits each after the 0x2f signature.
    const bits = (1000 - 1) | ((500 - 1) << 14);
    const lossless = [
      0x2f,
      bits & 255,
      (bits >>> 8) & 255,
      (bits >>> 16) & 255,
      (bits >>> 24) & 255,
    ];
    expect(imagePixelSize(riff('VP8L', lossless))).toEqual({ width: 1000, height: 500 });
    const extended = [0, 0, 0, 0, ...le24(4000 - 1), ...le24(3000 - 1)];
    expect(imagePixelSize(riff('VP8X', extended))).toEqual({ width: 4000, height: 3000 });
  });

  it('refuses what it cannot read: other bytes, a cut-short header, a zero side, a JPEG without a frame', () => {
    expect(imagePixelSize(new Uint8Array(32))).toBeNull();
    expect(imagePixelSize(bytes(0xff, 0xd8, 0xff, 0xe0, 0, 6, 0, 0, 0, 0, 0, 0))).toBeNull();
    expect(imagePixelSize(png(10, 10).slice(0, 20))).toBeNull();
    expect(imagePixelSize(png(0, 10))).toBeNull();
    expect(imagePixelSize(bytes(0xff, 0xd8, 0xff, 0xda, 0, 2, 0, 0, 0, 0, 0, 0))).toBeNull();
    expect(imagePixelSize(bytes(0xff, 0xd8, 0x00, 0x00, 0, 0, 0, 0, 0, 0, 0, 0))).toBeNull();
    expect(
      imagePixelSize(
        riff(
          'ALPH',
          Array.from({ length: 10 }, () => 0),
        ),
      ),
    ).toBeNull();
  });
});
