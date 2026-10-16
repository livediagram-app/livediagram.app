// A picture's size in pixels, read from its header, for the accepted raster formats (./image-sniff.ts). The image
// embedder (./embed-images.ts) spends a pixel budget with it: a renderer decodes each picture at full size, so its
// memory follows the pixels, not the bytes (a flat 8000x8000 PNG is 0.19 MB on disk and 256 MB decoded). Pure and
// worker-safe; reads only the first bytes it needs and never decodes.

export type PixelSize = { width: number; height: number };

const u16be = (b: Uint8Array, i: number) => (b[i]! << 8) | b[i + 1]!;
const u16le = (b: Uint8Array, i: number) => b[i]! | (b[i + 1]! << 8);
const u24le = (b: Uint8Array, i: number) => b[i]! | (b[i + 1]! << 8) | (b[i + 2]! << 16);
const u32be = (b: Uint8Array, i: number) =>
  ((b[i]! << 24) >>> 0) + (b[i + 1]! << 16) + u16be(b, i + 2);
const tag = (b: Uint8Array, i: number, text: string) =>
  [...text].every((ch, k) => b[i + k] === ch.charCodeAt(0));

// JPEG start-of-frame markers carry the size: C0-CF, except C4 (Huffman tables), C8 (reserved) and CC (arithmetic
// coding conditioning), which are other segments.
const isStartOfFrame = (marker: number) =>
  marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;

function jpegSize(b: Uint8Array): PixelSize | null {
  let i = 2;
  while (i + 9 < b.length) {
    if (b[i] !== 0xff) return null;
    const marker = b[i + 1]!;
    // Fill bytes before a marker.
    if (marker === 0xff) {
      i += 1;
      continue;
    }
    // Markers without a length: restart markers and TEM.
    if ((marker >= 0xd0 && marker <= 0xd7) || marker === 0x01) {
      i += 2;
      continue;
    }
    if (isStartOfFrame(marker)) return { height: u16be(b, i + 5), width: u16be(b, i + 7) };
    // Start of scan or end of image before any frame: no size to read.
    if (marker === 0xda || marker === 0xd9) return null;
    i += 2 + u16be(b, i + 2);
  }
  return null;
}

function webpSize(b: Uint8Array): PixelSize | null {
  if (b.length < 30) return null;
  if (tag(b, 12, 'VP8 ')) return { width: u16le(b, 26) & 0x3fff, height: u16le(b, 28) & 0x3fff };
  if (tag(b, 12, 'VP8L')) {
    const bits = b[21]! | (b[22]! << 8) | (b[23]! << 16) | (b[24]! << 24);
    return { width: (bits & 0x3fff) + 1, height: ((bits >>> 14) & 0x3fff) + 1 };
  }
  if (tag(b, 12, 'VP8X')) return { width: u24le(b, 24) + 1, height: u24le(b, 27) + 1 };
  return null;
}

// The picture's width and height, or null when the bytes are no accepted format or the header is cut short.
export function imagePixelSize(b: Uint8Array): PixelSize | null {
  let size: PixelSize | null = null;
  if (b.length >= 24 && b[0] === 0x89 && tag(b, 1, 'PNG') && tag(b, 12, 'IHDR')) {
    size = { width: u32be(b, 16), height: u32be(b, 20) };
  } else if (b.length >= 10 && tag(b, 0, 'GIF8')) {
    size = { width: u16le(b, 6), height: u16le(b, 8) };
  } else if (b.length >= 4 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) {
    size = jpegSize(b);
  } else if (b.length >= 12 && tag(b, 0, 'RIFF') && tag(b, 8, 'WEBP')) {
    size = webpSize(b);
  }
  return size && size.width > 0 && size.height > 0 ? size : null;
}
