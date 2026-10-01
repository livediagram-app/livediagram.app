// Payload readers for the Microsoft Whiteboard format (docs/specs/020-import-export/
// whiteboard-import.md "Values"). Every reader takes untrusted bytes and returns null for anything
// it cannot read; none throws.
import type { SceneColour } from '@/lib/board-scene/scene';

const byteHex = (b: number) => b.toString(16).padStart(2, '0');

/** A colour from its channels; alpha omitted when opaque. */
function colour(r: number, g: number, b: number, a: number): SceneColour {
  const hex = '#' + byteHex(r) + byteHex(g) + byteHex(b);
  return a === 255 ? { hex } : { hex, alpha: a / 255 };
}

/** A number by its payload length: int8, int16, int32 or float64, little-endian. */
export function readNumber(bytes: Uint8Array): number | null {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  switch (bytes.length) {
    case 1:
      return view.getInt8(0);
    case 2:
      return view.getInt16(0, true);
    case 4:
      return view.getInt32(0, true);
    case 8:
      return view.getFloat64(0, true);
    default:
      return null;
  }
}

/** A shape, note or background colour: A R G B, or the single byte FF for white. */
export function readArgb(bytes: Uint8Array): SceneColour | null {
  if (bytes.length === 1) return bytes[0] === 0xff ? { hex: '#ffffff' } : null;
  if (bytes.length !== 4) return null;
  return colour(bytes[1]!, bytes[2]!, bytes[3]!, bytes[0]!);
}

/** A little-endian base-128 varint at `at`: [value, next], or null when it runs off the end. */
export function readVarint(bytes: Uint8Array, at: number): [number, number] | null {
  let value = 0;
  let scale = 1;
  for (let i = at; i < bytes.length; i++) {
    const b = bytes[i]!;
    value += (b & 0x7f) * scale;
    if ((b & 0x80) === 0) return [value, i + 1];
    scale *= 128;
    if (scale > 2 ** 56) return null;
  }
  return null;
}

/** Zig-zag decoding: 0, 1, 2, 3 to 0, -1, 1, -2. */
export const zigzag = (v: number): number => (v % 2 === 1 ? -(v + 1) / 2 : v / 2);

/** A pen colour: 01, then a zig-zag varint whose 32 bits, high to low, are B G R A. */
export function readPenColour(bytes: Uint8Array): SceneColour | null {
  if (bytes[0] !== 1) return null;
  const read = readVarint(bytes, 1);
  if (!read) return null;
  const u = zigzag(read[0]) >>> 0;
  return colour((u >>> 8) & 0xff, (u >>> 16) & 0xff, u >>> 24, u & 0xff);
}

/**
 * A packed double at `at`: the first byte is the double's top byte; each following byte adds 7
 * bits below it, its high bit set when another follows; the rest are zero.
 */
export function readPackedDouble(bytes: Uint8Array, at: number): [number, number] | null {
  if (at >= bytes.length) return null;
  let bits = BigInt(bytes[at]!) << 56n;
  let shift = 49n;
  let i = at + 1;
  for (;;) {
    if (i >= bytes.length || shift < -6n) return null;
    const b = bytes[i++]!;
    const group = BigInt(b & 0x7f);
    bits |= shift >= 0n ? group << shift : group >> -shift;
    shift -= 7n;
    if ((b & 0x80) === 0) break;
  }
  const view = new DataView(new ArrayBuffer(8));
  view.setBigUint64(0, bits & 0xffffffffffffffffn);
  return [view.getFloat64(0), i];
}

/** Base64 to bytes, or null when it isn't base64. */
export function base64ToBytes(text: string): Uint8Array | null {
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(text)) return null;
  try {
    const binary = atob(text);
    const out = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
    return out;
  } catch {
    return null;
  }
}

const UTF8 = new TextDecoder('utf-8');

/** UTF-8 text (invalid sequences become replacement characters). */
export const utf8 = (bytes: Uint8Array): string => UTF8.decode(bytes);
