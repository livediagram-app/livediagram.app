// A picture's width and height from its bytes (liveworkspace/docs/specs/006-media/media.md "Uploaded by a tool"), for
// an upload that has no browser to decode it (the MCP's upload_image, the CLI's `image add`). Reads only the headers
// of the accepted formats, never a pixel: the PNG IHDR, a JPEG's first frame header, the GIF logical screen and the
// WebP VP8, VP8L and VP8X headers. Pure, so it runs in Workers and Node alike.

import type { AcceptedImageType } from './limits';

export type ImageDimensions = { width: number; height: number };

const dims = (width: number, height: number): ImageDimensions | null =>
  width > 0 && height > 0 ? { width, height } : null;

const u16be = (b: Uint8Array, at: number) => (b[at]! << 8) | b[at + 1]!;
const u16le = (b: Uint8Array, at: number) => b[at]! | (b[at + 1]! << 8);
const u24le = (b: Uint8Array, at: number) => b[at]! | (b[at + 1]! << 8) | (b[at + 2]! << 16);
const u32be = (b: Uint8Array, at: number) =>
  b[at]! * 0x1000000 + ((b[at + 1]! << 16) | (b[at + 2]! << 8) | b[at + 3]!);

function png(b: Uint8Array): ImageDimensions | null {
  // Signature (8), then the IHDR chunk: length (4), "IHDR" (4), width (4), height (4).
  if (b.length < 24 || b[12] !== 0x49 || b[13] !== 0x48 || b[14] !== 0x44 || b[15] !== 0x52) {
    return null;
  }
  return dims(u32be(b, 16), u32be(b, 20));
}

function gif(b: Uint8Array): ImageDimensions | null {
  return b.length < 10 ? null : dims(u16le(b, 6), u16le(b, 8));
}

// The start-of-frame markers that carry a frame's size: SOF0 to SOF15 but DHT (C4), JPG (C8) and DAC (CC).
const isFrameMarker = (m: number) =>
  m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc;

function jpeg(b: Uint8Array): ImageDimensions | null {
  let at = 2;
  while (at + 4 <= b.length) {
    if (b[at] !== 0xff) return null;
    const marker = b[at + 1]!;
    // A fill byte before a marker.
    if (marker === 0xff) {
      at += 1;
      continue;
    }
    // Markers without a length: TEM and RST0 to RST7.
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      at += 2;
      continue;
    }
    // The end of the image, or its scan, before any frame header.
    if (marker === 0xd9 || marker === 0xda) return null;
    const length = u16be(b, at + 2);
    if (length < 2) return null;
    if (isFrameMarker(marker)) {
      // Length (2), precision (1), height (2), width (2).
      if (at + 9 > b.length) return null;
      return dims(u16be(b, at + 7), u16be(b, at + 5));
    }
    at += 2 + length;
  }
  return null;
}

function webp(b: Uint8Array): ImageDimensions | null {
  if (b.length < 30) return null;
  const chunk = String.fromCharCode(b[12]!, b[13]!, b[14]!, b[15]!);
  // Lossy: a key frame's start code (9D 01 2A), then 14-bit width and height.
  if (chunk === 'VP8 ') {
    if (b[23] !== 0x9d || b[24] !== 0x01 || b[25] !== 0x2a) return null;
    return dims(u16le(b, 26) & 0x3fff, u16le(b, 28) & 0x3fff);
  }
  // Lossless: the signature 2F, then width - 1 and height - 1 in 14 bits each.
  if (chunk === 'VP8L') {
    if (b[20] !== 0x2f) return null;
    const bits = (b[21]! | (b[22]! << 8) | (b[23]! << 16) | (b[24]! << 24)) >>> 0;
    return dims((bits & 0x3fff) + 1, ((bits >>> 14) & 0x3fff) + 1);
  }
  // Extended: the canvas's width - 1 and height - 1, 24 bits each.
  if (chunk === 'VP8X') return dims(u24le(b, 24) + 1, u24le(b, 27) + 1);
  return null;
}

/** The picture's size in pixels as its header gives it, or null when the header can't be read. `type` is what
 *  `sniffImageType` made of the same bytes. */
export function imageDimensions(
  bytes: Uint8Array,
  type: AcceptedImageType,
): ImageDimensions | null {
  if (type === 'image/png') return png(bytes);
  if (type === 'image/gif') return gif(bytes);
  if (type === 'image/jpeg') return jpeg(bytes);
  return webp(bytes);
}
