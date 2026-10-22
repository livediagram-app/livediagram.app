// A PNG decoder for the tiles a photo stores (docs/specs/031-photo/photo-store.md): 8-bit, not
// interlaced, grey, grey and alpha, RGB or RGBA, inflated with the platform's DecompressionStream.
// It keeps straight alpha exactly, where a canvas premultiplies and so loses the colour of faint
// pixels. Anything else answers null, for the host to decode as a picture.
import { createRaster, type Raster } from '../raster/raster';

const SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

// Bytes a pixel has, by colour type.
const CHANNELS: Record<number, number> = { 0: 1, 2: 3, 4: 2, 6: 4 };

async function inflate(data: Uint8Array): Promise<Uint8Array> {
  const ds = new DecompressionStream('deflate');
  const writer = ds.writable.getWriter();
  void writer.write(data as Uint8Array<ArrayBuffer>);
  void writer.close();
  const parts: Uint8Array[] = [];
  const reader = ds.readable.getReader();
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    parts.push(value);
  }
  let total = 0;
  for (const p of parts) total += p.length;
  const out = new Uint8Array(total);
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}

const paeth = (a: number, b: number, c: number): number => {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
};

/** The PNG's pixels as straight RGBA, or null when it is not a kind this decoder reads. */
export async function decodePng(bytes: Uint8Array): Promise<Raster | null> {
  if (bytes.length < 33 || SIGNATURE.some((b, i) => bytes[i] !== b)) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let width = 0;
  let height = 0;
  let type = -1;
  const idat: Uint8Array[] = [];
  for (let at = 8; at + 8 <= bytes.length;) {
    const len = view.getUint32(at);
    const name = String.fromCharCode(
      bytes[at + 4]!,
      bytes[at + 5]!,
      bytes[at + 6]!,
      bytes[at + 7]!,
    );
    const body = bytes.subarray(at + 8, at + 8 + len);
    if (name === 'IHDR') {
      width = view.getUint32(at + 8);
      height = view.getUint32(at + 12);
      const depth = body[8];
      type = body[9]!;
      // Bit depth 8, the standard compression and filtering, not interlaced.
      if (depth !== 8 || body[10] !== 0 || body[11] !== 0 || body[12] !== 0 || !(type in CHANNELS))
        return null;
    } else if (name === 'IDAT') idat.push(body);
    else if (name === 'tRNS') return null;
    else if (name === 'IEND') break;
    at += 12 + len;
  }
  if (!width || !height || !idat.length) return null;
  let total = 0;
  for (const p of idat) total += p.length;
  const packed = new Uint8Array(total);
  let o = 0;
  for (const p of idat) {
    packed.set(p, o);
    o += p.length;
  }
  const raw = await inflate(packed);
  const bpp = CHANNELS[type]!;
  const stride = width * bpp;
  if (raw.length < height * (stride + 1)) return null;
  const rows = new Uint8Array(height * stride);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)]!;
    const src = y * (stride + 1) + 1;
    const dst = y * stride;
    const up = dst - stride;
    for (let i = 0; i < stride; i++) {
      const x = raw[src + i]!;
      const a = i >= bpp ? rows[dst + i - bpp]! : 0;
      const b = y ? rows[up + i]! : 0;
      const c = y && i >= bpp ? rows[up + i - bpp]! : 0;
      let v: number;
      switch (filter) {
        case 0:
          v = x;
          break;
        case 1:
          v = x + a;
          break;
        case 2:
          v = x + b;
          break;
        case 3:
          v = x + ((a + b) >> 1);
          break;
        case 4:
          v = x + paeth(a, b, c);
          break;
        default:
          return null;
      }
      rows[dst + i] = v & 255;
    }
  }
  const out = createRaster(width, height);
  const d = out.data;
  for (let p = 0, s = 0; p < width * height; p++, s += bpp) {
    const i = p * 4;
    if (bpp === 4) d.set(rows.subarray(s, s + 4), i);
    else if (bpp === 3) {
      d[i] = rows[s]!;
      d[i + 1] = rows[s + 1]!;
      d[i + 2] = rows[s + 2]!;
      d[i + 3] = 255;
    } else {
      const g = rows[s]!;
      d[i] = g;
      d[i + 1] = g;
      d[i + 2] = g;
      d[i + 3] = bpp === 2 ? rows[s + 1]! : 255;
    }
  }
  return out;
}
