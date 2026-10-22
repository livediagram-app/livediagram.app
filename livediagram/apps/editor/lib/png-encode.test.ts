import { inflateSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { encodePngRgba } from './png-encode';
import { crc32 } from './crc32';

// Splits a PNG into its chunks, checking each chunk's CRC on the way.
function chunks(png: Uint8Array): { type: string; body: Uint8Array }[] {
  const view = new DataView(png.buffer, png.byteOffset, png.byteLength);
  const out: { type: string; body: Uint8Array }[] = [];
  for (let at = 8; at < png.length;) {
    const len = view.getUint32(at);
    const type = String.fromCharCode(...png.subarray(at + 4, at + 8));
    const body = png.subarray(at + 8, at + 8 + len);
    expect(view.getUint32(at + 8 + len)).toBe(crc32(png.subarray(at + 4, at + 8 + len)));
    out.push({ type, body });
    at += 12 + len;
  }
  return out;
}

function pixels(width: number, height: number): Uint8ClampedArray {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < data.length; i++) data[i] = (i * 31) % 256;
  return data;
}

describe('encodePngRgba', () => {
  it('writes the signature, an RGBA header and the pixels as stored zlib', () => {
    const data = pixels(3, 2);
    const png = encodePngRgba(3, 2, data);
    expect([...png.subarray(0, 8)]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const [ihdr, idat, iend] = chunks(png);
    expect(ihdr!.type).toBe('IHDR');
    const h = new DataView(ihdr!.body.buffer, ihdr!.body.byteOffset, 13);
    expect([h.getUint32(0), h.getUint32(4), ihdr!.body[8], ihdr!.body[9]]).toEqual([3, 2, 8, 6]);
    expect(idat!.type).toBe('IDAT');
    expect(iend).toEqual({ type: 'IEND', body: new Uint8Array(0) });
    // zlib inflates it (checking the Adler-32 too): each row is filter 0, then its pixels.
    const raw = inflateSync(idat!.body);
    expect([...raw.subarray(0, 1)]).toEqual([0]);
    expect([...raw.subarray(1, 13)]).toEqual([...data.subarray(0, 12)]);
    expect([...raw.subarray(14, 26)]).toEqual([...data.subarray(12, 24)]);
  });

  it('splits image data larger than one stored block across several', () => {
    // 200 x 100 RGBA is 80,100 bytes with the filter bytes: two blocks.
    const data = pixels(200, 100);
    const raw = inflateSync(chunks(encodePngRgba(200, 100, data))[1]!.body);
    expect(raw.length).toBe(100 * (1 + 200 * 4));
    expect([...raw.subarray(raw.length - 800)]).toEqual([...data.subarray(data.length - 800)]);
  });

  it('refuses pixels that do not match the size', () => {
    expect(() => encodePngRgba(2, 2, new Uint8ClampedArray(4))).toThrow(/size mismatch/);
  });
});
