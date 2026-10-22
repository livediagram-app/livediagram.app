import { describe, expect, it } from 'vitest';
import { stripJpegMetadata } from './image-strip';

// Build a JPEG byte sequence by spelling out the segments we want.
// Returns an ArrayBuffer (the strip helper's input contract). Each
// segment block here is `[ marker_byte, hi_len, lo_len, ...payload ]`
// where len includes the two length bytes themselves. Lengths are
// big-endian. `mkSegment` handles the length math so each test
// reads as a list of high-level segments, not bare bytes.
function bytes(parts: number[][]): ArrayBuffer {
  const flat: number[] = [];
  for (const p of parts) flat.push(...p);
  return new Uint8Array(flat).buffer;
}
function mkSegment(marker: number, payload: number[]): number[] {
  const len = payload.length + 2;
  return [0xff, marker, (len >> 8) & 0xff, len & 0xff, ...payload];
}

// The four building blocks every JPEG carries: start of image, a
// quantisation table (any non-stripped table works), start of scan,
// raw entropy-coded data (one byte stand-in), end of image.
const SOI = [0xff, 0xd8];
const DQT = mkSegment(0xdb, [0x00, 0x01, 0x02, 0x03]); // marker 0xDB, kept.
const SOS = mkSegment(0xda, [0x00, 0x00, 0x00]); // marker 0xDA, payload 3.
const SCAN_DATA = [0x12, 0x34, 0x56]; // raw entropy-coded stream, no length.
const EOI = [0xff, 0xd9];

describe('stripJpegMetadata', () => {
  it('returns the input unchanged when the SOI marker is missing', () => {
    // Not a JPEG: pass-through. Defence in depth; callers should
    // already gate on sniffImageType.
    const buf = new Uint8Array([0x00, 0x01, 0x02, 0x03]).buffer;
    const out = stripJpegMetadata(buf);
    expect(new Uint8Array(out)).toEqual(new Uint8Array(buf));
  });

  it('returns a JPEG with no metadata segments unchanged', () => {
    const input = bytes([SOI, DQT, SOS, SCAN_DATA, EOI]);
    const out = stripJpegMetadata(input);
    expect(new Uint8Array(out)).toEqual(new Uint8Array(input));
  });

  it('strips an APP1 (EXIF) segment but keeps SOI / DQT / SOS / data / EOI', () => {
    const exif = mkSegment(
      0xe1,
      [
        // "Exif\0\0" identifier + a few junk bytes representing the IFD.
        0x45, 0x78, 0x69, 0x66, 0x00, 0x00, 0xde, 0xad, 0xbe, 0xef,
      ],
    );
    const input = bytes([SOI, exif, DQT, SOS, SCAN_DATA, EOI]);
    const expected = bytes([SOI, DQT, SOS, SCAN_DATA, EOI]);
    const out = stripJpegMetadata(input);
    expect(new Uint8Array(out)).toEqual(new Uint8Array(expected));
  });

  it('strips JFIF (APP0), ICC (APP2), and COM segments alongside EXIF', () => {
    const jfif = mkSegment(0xe0, [0x4a, 0x46, 0x49, 0x46, 0x00]); // "JFIF\0"
    const exif = mkSegment(0xe1, [0x45, 0x78, 0x69, 0x66, 0x00, 0x00, 0xff]);
    const icc = mkSegment(0xe2, [0x49, 0x43, 0x43, 0x5f]); // "ICC_"
    const com = mkSegment(0xfe, [0x68, 0x65, 0x6c, 0x6c, 0x6f]); // "hello"
    const input = bytes([SOI, jfif, exif, icc, com, DQT, SOS, SCAN_DATA, EOI]);
    const expected = bytes([SOI, DQT, SOS, SCAN_DATA, EOI]);
    expect(new Uint8Array(stripJpegMetadata(input))).toEqual(new Uint8Array(expected));
  });

  it('strips every APPn marker (E0..EF), not just E1', () => {
    // Camera vendors stash proprietary metadata in APP3..APPF
    // (e.g. GoPro in APP6). Stripping the whole APPn range catches
    // all of it without per-vendor knowledge.
    const segments = [SOI];
    for (let m = 0xe0; m <= 0xef; m++) {
      segments.push(mkSegment(m, [m, 0x42]));
    }
    segments.push(DQT, SOS, SCAN_DATA, EOI);
    const input = bytes(segments);
    const expected = bytes([SOI, DQT, SOS, SCAN_DATA, EOI]);
    expect(new Uint8Array(stripJpegMetadata(input))).toEqual(new Uint8Array(expected));
  });

  it('copies the SOS segment + raw entropy-coded stream verbatim through EOI', () => {
    // The image pixels live in the post-SOS stream. Any byte-level
    // edit there would corrupt the render; the helper has to copy
    // the entire remainder unchanged.
    const longScan = Array.from({ length: 256 }, (_, i) => i & 0xff);
    const input = bytes([SOI, DQT, SOS, longScan, EOI]);
    const out = new Uint8Array(stripJpegMetadata(input));
    // Find SOS marker in output + check every byte after through EOI.
    const sosIdx = out.indexOf(0xda);
    expect(sosIdx).toBeGreaterThan(0);
    // Two bytes after SOS marker are the length prefix; then 3 payload
    // bytes; then the raw stream + EOI. Compare from the raw stream
    // start to the EOI.
    const tailStart = sosIdx + 1 /* SOS code */ + 2 /* length */ + 3; /* SOS payload */
    const tail = out.slice(tailStart);
    const expectedTail = new Uint8Array([...longScan, 0xff, 0xd9]);
    expect(tail).toEqual(expectedTail);
  });

  it('throws on truncated input mid-segment so the upload endpoint fails loudly', () => {
    // A length prefix that runs past the end of the buffer is a
    // structural error; the helper must throw rather than silently
    // truncate (which could leak partial metadata).
    const input = new Uint8Array([0xff, 0xd8, 0xff, 0xe1, 0x00, 0xff, 0x45]).buffer;
    expect(() => stripJpegMetadata(input)).toThrow();
  });

  it('preserves RST markers (no payload, no length) in the stream', () => {
    // 0xD0..0xD7 are restart markers used inside the entropy-coded
    // stream. They have no length byte. Since the helper copies
    // everything after SOS verbatim, restart markers there pass
    // through naturally. This test exercises the standalone-marker
    // branch directly (placed BEFORE the SOS to hit the early
    // continue, even though real RSTs only appear after SOS).
    const input = bytes([SOI, DQT, [0xff, 0xd0], SOS, SCAN_DATA, EOI]);
    const expected = bytes([SOI, DQT, [0xff, 0xd0], SOS, SCAN_DATA, EOI]);
    expect(new Uint8Array(stripJpegMetadata(input))).toEqual(new Uint8Array(expected));
  });
});
