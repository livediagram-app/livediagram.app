import { deflateSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { createRaster } from '../raster/raster';
import { decodePng } from './png-decode';
import { encodePngStream } from './png-stream';

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function chunk(type: string, body: Uint8Array): Buffer {
  const t = Buffer.from(type, 'ascii');
  let c = 0xffffffff;
  for (const b of [...t, ...body]) c = crcTable[(c ^ b) & 0xff]! ^ (c >>> 8);
  const out = Buffer.alloc(12 + body.length);
  out.writeUInt32BE(body.length, 0);
  t.copy(out, 4);
  Buffer.from(body).copy(out, 8);
  out.writeUInt32BE((c ^ 0xffffffff) >>> 0, 8 + body.length);
  return out;
}
/** A PNG of `type` (bpp channels) with each row's filter as given. */
function png(
  width: number,
  height: number,
  type: number,
  bpp: number,
  pixels: number[],
  filters: number[],
): Uint8Array {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = type;
  const stride = width * bpp;
  const raw = Buffer.alloc(height * (stride + 1));
  for (let y = 0; y < height; y++) {
    const f = filters[y]!;
    raw[y * (stride + 1)] = f;
    for (let i = 0; i < stride; i++) {
      const x = pixels[y * stride + i]!;
      const a = i >= bpp ? pixels[y * stride + i - bpp]! : 0;
      const b = y ? pixels[(y - 1) * stride + i]! : 0;
      const c = y && i >= bpp ? pixels[(y - 1) * stride + i - bpp]! : 0;
      const p = a + b - c;
      const pr =
        Math.abs(p - a) <= Math.abs(p - b) && Math.abs(p - a) <= Math.abs(p - c)
          ? a
          : Math.abs(p - b) <= Math.abs(p - c)
            ? b
            : c;
      const pred = [0, a, b, (a + b) >> 1, pr][f]!;
      raw[y * (stride + 1) + 1 + i] = (x - pred) & 255;
    }
  }
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  return new Uint8Array(
    Buffer.concat([
      sig,
      chunk('IHDR', ihdr),
      chunk('IDAT', deflateSync(raw)),
      chunk('IEND', new Uint8Array()),
    ]),
  );
}

describe('decodePng', () => {
  it('round-trips the encoder exactly, faint pixels and all', async () => {
    const r = createRaster(37, 9);
    for (let i = 0; i < r.data.length; i++) r.data[i] = (i * 37 + (i >> 3)) & 255;
    // A nearly transparent pixel keeps its colour: a canvas would lose it.
    r.data.set([201, 99, 13, 1], 0);
    const blob = await encodePngStream(
      r.width,
      r.height,
      (y, rows) => ({
        width: r.width,
        height: rows,
        data: r.data.slice(y * r.width * 4, (y + rows) * r.width * 4),
      }),
      4,
    );
    const back = await decodePng(new Uint8Array(await blob.arrayBuffer()));
    expect(back?.width).toBe(37);
    expect(back?.height).toBe(9);
    expect([...back!.data]).toEqual([...r.data]);
  });

  it('reads every filter and grey, grey-alpha and RGB pictures', async () => {
    const rgb = Array.from({ length: 3 * 3 * 5 }, (_, i) => (i * 53) & 255);
    const out = await decodePng(png(3, 5, 2, 3, rgb, [0, 1, 2, 3, 4]));
    expect([...out!.data.subarray(0, 8)]).toEqual([
      rgb[0],
      rgb[1],
      rgb[2],
      255,
      rgb[3],
      rgb[4],
      rgb[5],
      255,
    ]);
    expect(out!.data[(4 * 3 + 2) * 4 + 2]).toBe(rgb[(4 * 3 + 2) * 3 + 2]);
    const ga = await decodePng(png(2, 1, 4, 2, [10, 20, 30, 40], [4]));
    expect([...ga!.data]).toEqual([10, 10, 10, 20, 30, 30, 30, 40]);
    const g = await decodePng(png(2, 1, 0, 1, [7, 9], [1]));
    expect([...g!.data]).toEqual([7, 7, 7, 255, 9, 9, 9, 255]);
  });

  it('declines what it does not read', async () => {
    expect(await decodePng(new Uint8Array([1, 2, 3]))).toBeNull();
    const palette = png(1, 1, 2, 3, [1, 2, 3], [0]);
    palette[8 + 8 + 9] = 3; // colour type 3
    expect(await decodePng(palette)).toBeNull();
  });
});
