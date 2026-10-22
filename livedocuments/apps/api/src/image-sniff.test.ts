import { describe, expect, it } from 'vitest';
import { ACCEPTED_IMAGE_TYPES, sniffImageType } from './image-sniff';

// Build a buffer at least 12 bytes long (the sniffer's minimum gate),
// padding the tail with NULs after the supplied magic bytes. Mirrors
// what the worker passes through from `bytes.slice(0, 16)` at the
// upload boundary, so each test exercises sniff under the same shape
// of input the real call site uses.
function buf(bytes: number[]): Uint8Array {
  const out = new Uint8Array(Math.max(bytes.length, 16));
  for (let i = 0; i < bytes.length; i++) out[i] = bytes[i]!;
  return out;
}

describe('sniffImageType', () => {
  it('returns null when the buffer is shorter than the 12-byte minimum', () => {
    expect(sniffImageType(new Uint8Array(11))).toBeNull();
    expect(sniffImageType(new Uint8Array(0))).toBeNull();
  });

  it('accepts the PNG magic header', () => {
    expect(sniffImageType(buf([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe('image/png');
  });

  it('rejects a PNG header with one byte flipped', () => {
    // Same eight bytes as PNG but with byte 4 flipped (CR -> NUL).
    // A real PNG always carries this exact run; sniff must not be
    // lenient.
    expect(sniffImageType(buf([0x89, 0x50, 0x4e, 0x47, 0x00, 0x0a, 0x1a, 0x0a]))).toBeNull();
  });

  it('accepts the JPEG SOI + first marker prefix', () => {
    expect(sniffImageType(buf([0xff, 0xd8, 0xff, 0xe0]))).toBe('image/jpeg');
    expect(sniffImageType(buf([0xff, 0xd8, 0xff, 0xdb]))).toBe('image/jpeg');
  });

  it('rejects JPEG when the third byte is not FF', () => {
    // FF D8 alone is not enough: a sane sniff also checks the next
    // marker byte. Defence against headers that only carry the SOI.
    expect(sniffImageType(buf([0xff, 0xd8, 0x00, 0x00]))).toBeNull();
  });

  it('accepts both GIF87a and GIF89a magic headers', () => {
    // "GIF87a"
    expect(sniffImageType(buf([0x47, 0x49, 0x46, 0x38, 0x37, 0x61]))).toBe('image/gif');
    // "GIF89a"
    expect(sniffImageType(buf([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]))).toBe('image/gif');
  });

  it('rejects a GIF-like header with the wrong sub-version byte', () => {
    // "GIF88a" (not a real GIF version).
    expect(sniffImageType(buf([0x47, 0x49, 0x46, 0x38, 0x38, 0x61]))).toBeNull();
  });

  it('accepts the WebP RIFF...WEBP container header', () => {
    // bytes 0-3: "RIFF", bytes 4-7: file length (ignored), bytes 8-11: "WEBP".
    expect(
      sniffImageType(buf([0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50])),
    ).toBe('image/webp');
  });

  it('rejects a RIFF container whose form ID is not WEBP', () => {
    // RIFF with "WAVE" (audio) inside, must not be misread as an image.
    expect(
      sniffImageType(buf([0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x41, 0x56, 0x45])),
    ).toBeNull();
  });

  it('rejects an SVG payload masquerading as a permitted type', () => {
    // The XSS vector this sniff exists to block: SVG is XML and can
    // carry inline <script>. The api accepts the upload only if the
    // sniffed type matches the client-declared Content-Type, so
    // sniff returning null here is what closes the front door.
    const svg = new TextEncoder().encode(
      '<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg"',
    );
    expect(sniffImageType(svg)).toBeNull();
  });

  it('rejects an HTML payload at the upload boundary', () => {
    const html = new TextEncoder().encode('<!doctype html><html><body><script>');
    expect(sniffImageType(html)).toBeNull();
  });

  it('rejects an all-zero buffer of sufficient length', () => {
    expect(sniffImageType(new Uint8Array(32))).toBeNull();
  });

  it('returns only members of the accepted-types whitelist', () => {
    // Property check: any non-null sniff result MUST be one of the
    // four constants the api exposes via ACCEPTED_IMAGE_TYPES. If
    // the function ever grew to return a new MIME type without the
    // whitelist being updated, the worker's content-type validation
    // would silently start accepting it.
    const samples: Uint8Array[] = [
      buf([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      buf([0xff, 0xd8, 0xff, 0xe0]),
      buf([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]),
      buf([0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50]),
    ];
    for (const s of samples) {
      const result = sniffImageType(s);
      expect(result).not.toBeNull();
      expect(ACCEPTED_IMAGE_TYPES).toContain(result);
    }
  });
});
