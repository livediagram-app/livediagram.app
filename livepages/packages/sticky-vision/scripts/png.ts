import { readFileSync } from 'node:fs';
import { deflateSync, inflateSync } from 'node:zlib';
import type { ImageBuffer } from '../src/colour';

// PNG in, PNG out. No dependency: node's zlib is the only hard part of either.
// Used by the calibration loop to read working copies of real photographs and
// to write the overlay that makes "did it find the notes" a question you can
// answer by looking, and by the editor's e2e suite to encode the wall it
// draws. Node only; exported as `@livediagram/sticky-vision/png`.

export function decodePng(path: string): ImageBuffer {
  return decodePngBuffer(readFileSync(path));
}

export function decodePngBuffer(buf: Buffer): ImageBuffer {
  let pos = 8;
  let width = 0;
  let height = 0;
  let colourType = 2;
  const idat: Buffer[] = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.toString('ascii', pos + 4, pos + 8);
    const data = buf.subarray(pos + 8, pos + 8 + len);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      colourType = data[9]!;
    }
    if (type === 'IDAT') idat.push(Buffer.from(data));
    pos += 12 + len;
  }
  const bpp = colourType === 6 ? 4 : 3;
  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * bpp;
  const out = new Uint8ClampedArray(width * height * 4);
  const prev = new Uint8Array(stride);
  const cur = new Uint8Array(stride);
  let p = 0;
  for (let y = 0; y < height; y += 1) {
    const filter = raw[p]!;
    p += 1;
    for (let i = 0; i < stride; i += 1) {
      const x = raw[p + i]!;
      const a = i >= bpp ? cur[i - bpp]! : 0;
      const b = prev[i]!;
      const c = i >= bpp ? prev[i - bpp]! : 0;
      let v = x;
      if (filter === 1) v = x + a;
      else if (filter === 2) v = x + b;
      else if (filter === 3) v = x + ((a + b) >> 1);
      else if (filter === 4) {
        const pa = Math.abs(b - c);
        const pb = Math.abs(a - c);
        const pc = Math.abs(a + b - 2 * c);
        v = x + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c);
      }
      cur[i] = v & 255;
    }
    p += stride;
    for (let x = 0; x < width; x += 1) {
      const o = (y * width + x) * 4;
      out[o] = cur[x * bpp]!;
      out[o + 1] = cur[x * bpp + 1]!;
      out[o + 2] = cur[x * bpp + 2]!;
      out[o + 3] = 255;
    }
    prev.set(cur);
  }
  return { width, height, data: out };
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

// Minimal PNG: one IHDR (8-bit truecolour), one IDAT of zlib-deflated
// scanlines (filter 0), one IEND. Enough for any browser, small enough to
// read. `data` is RGBA by default (an ImageBuffer, alpha dropped); pass
// `channels: 3` for packed RGB.
export function encodePng(
  image: { width: number; height: number; data: ArrayLike<number> },
  opts: { channels?: 3 | 4 } = {},
): Buffer {
  const { width, height, data } = image;
  const channels = opts.channels ?? 4;
  const stride = width * 3;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y += 1) {
    raw[y * (stride + 1)] = 0; // filter: none
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * channels;
      const o = y * (stride + 1) + 1 + x * 3;
      raw[o] = data[i]!;
      raw[o + 1] = data[i + 1]!;
      raw[o + 2] = data[i + 2]!;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type: truecolour
  const crc = (b: Buffer) => {
    let c = 0xffffffff;
    for (const byte of b) c = CRC_TABLE[(c ^ byte) & 0xff]! ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type: string, payload: Buffer) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(payload.length, 0);
    const body = Buffer.concat([Buffer.from(type, 'ascii'), payload]);
    const check = Buffer.alloc(4);
    check.writeUInt32BE(crc(body), 0);
    return Buffer.concat([len, body, check]);
  };
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}
