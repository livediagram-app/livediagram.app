import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { exifOrientation, orientationSegment, stripJpegMetadata } from './jpeg-strip';

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

  it('strips JFIF (APP0), a non-profile APP2, and COM segments alongside EXIF', () => {
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

  it('keeps ICC profile chunks (APP2) and the Adobe segment (APP14) in place', () => {
    const icc1 = mkSegment(0xe2, [...ascii('ICC_PROFILE\0'), 1, 2, 0xaa]);
    const icc2 = mkSegment(0xe2, [...ascii('ICC_PROFILE\0'), 2, 2, 0xbb]);
    const mpf = mkSegment(0xe2, [...ascii('MPF\0'), 0x01]);
    const adobe = mkSegment(0xee, [...ascii('Adobe'), 0x00, 0x64, 0, 0, 0, 0, 2]);
    const input = bytes([SOI, icc1, icc2, mpf, adobe, DQT, SOS, SCAN_DATA, EOI]);
    const expected = bytes([SOI, icc1, icc2, adobe, DQT, SOS, SCAN_DATA, EOI]);
    expect(new Uint8Array(stripJpegMetadata(input))).toEqual(new Uint8Array(expected));
  });

  it('writes the Exif Orientation back alone, straight after SOI', () => {
    for (const little of [true, false]) {
      const exif = mkSegment(
        0xe1,
        exifPayload(little, [
          [0x010f, 2, 4, 'Cam\0'],
          [0x0112, 3, 1, 6],
        ]),
      );
      const jfif = mkSegment(0xe0, [0x4a, 0x46]);
      const input = bytes([SOI, jfif, exif, DQT, SOS, SCAN_DATA, EOI]);
      const expected = bytes([SOI, orientationSegment(6), DQT, SOS, SCAN_DATA, EOI]);
      expect(new Uint8Array(stripJpegMetadata(input))).toEqual(new Uint8Array(expected));
    }
  });

  it('writes nothing back for the default orientation, a broken Exif or one without the tag', () => {
    const header = (order: number, magic: number, offset: number) => [
      ...ascii('Exif\0\0'),
      order,
      order,
      magic,
      0x00,
      offset,
      0x00,
      0x00,
      0x00,
    ];
    const cases = [
      exifPayload(true, [[0x0112, 3, 1, 1]]),
      exifPayload(true, [[0x0112, 3, 1, 9]]),
      exifPayload(true, [[0x0112, 4, 1, 6]]),
      exifPayload(true, [[0x010f, 2, 4, 'Cam\0']]),
      header(0x49, 0x2a, 0xff),
      header(0x58, 0x2a, 0x08),
      header(0x49, 0x2b, 0x08),
      [...ascii('Exif\0\0'), 0x49, 0x49],
      [...header(0x49, 0x2a, 0x08), 0x05, 0x00],
    ];
    for (const payload of cases) {
      const input = bytes([SOI, mkSegment(0xe1, payload), DQT, SOS, SCAN_DATA, EOI]);
      const expected = bytes([SOI, DQT, SOS, SCAN_DATA, EOI]);
      expect(new Uint8Array(stripJpegMetadata(input))).toEqual(new Uint8Array(expected));
    }
  });

  it('reads the orientation from the first Exif segment only', () => {
    const first = mkSegment(0xe1, exifPayload(false, [[0x0112, 3, 1, 3]]));
    const second = mkSegment(0xe1, exifPayload(false, [[0x0112, 3, 1, 8]]));
    const input = bytes([SOI, first, second, DQT, SOS, SCAN_DATA, EOI]);
    const expected = bytes([SOI, orientationSegment(3), DQT, SOS, SCAN_DATA, EOI]);
    expect(new Uint8Array(stripJpegMetadata(input))).toEqual(new Uint8Array(expected));
    expect(exifOrientation(new Uint8Array(ascii('XMP')), 0, 3)).toBeNull();
  });

  it("keeps a real phone photo's orientation and colour profile, and drops its camera and GPS data", () => {
    // A 64x32 JPEG written by macOS sips with a Display P3 profile, given a phone's little-endian
    // Exif (Make, Model, Orientation 6 and a GPS IFD), an XMP packet, an Adobe segment and a comment.
    const file = readFileSync(new URL('./fixtures/portrait-exif.jpg', import.meta.url).pathname);
    const input = new Uint8Array(file).buffer;
    const out = new Uint8Array(stripJpegMetadata(input));
    const text = new TextDecoder('latin1').decode(out);
    const secrets = ['Serial-XYZ', 'PhoneCo', 'GPS-SECRET', 'XMP-SECRET', 'COMMENT-SECRET', 'JFIF'];
    for (const secret of secrets) expect(text).not.toContain(secret);
    // The profile and the Adobe segment come through whole, byte for byte.
    const original = new TextDecoder('latin1').decode(file);
    const segmentOf = (marker: string) => {
      const at = original.indexOf(`\xff${marker}`);
      return original.slice(at, at + 2 + file.readUInt16BE(at + 2));
    };
    expect(segmentOf('\xe2')).toContain('ICC_PROFILE\0');
    expect(segmentOf('\xe2').length).toBeGreaterThan(500);
    expect(text).toContain(segmentOf('\xe2'));
    expect(text).toContain(segmentOf('\xee'));
    const written = orientationSegment(6);
    expect(Array.from(out.subarray(2, 2 + written.length))).toEqual(written);
    // The scan (the pixels) is untouched.
    const scan = (b: Uint8Array) =>
      b.subarray(new TextDecoder('latin1').decode(b).indexOf('\xff\xda'));
    expect(scan(out).length).toBeGreaterThan(100);
    expect(scan(out)).toEqual(scan(new Uint8Array(input)));
  });
});

function ascii(text: string): number[] {
  return Array.from(text, (c) => c.charCodeAt(0));
}

// An Exif APP1 payload with one IFD of `entries` ([tag, type, count, value]): a string value goes
// after the IFD by offset, a number sits in the entry.
function exifPayload(little: boolean, entries: [number, number, number, number | string][]) {
  const u16 = (v: number) => (little ? [v & 0xff, v >> 8] : [v >> 8, v & 0xff]);
  const u32 = (v: number) =>
    little
      ? [v & 0xff, (v >> 8) & 0xff, (v >> 16) & 0xff, v >>> 24]
      : [v >>> 24, (v >> 16) & 0xff, (v >> 8) & 0xff, v & 0xff];
  const tiff = [...(little ? [0x49, 0x49] : [0x4d, 0x4d]), ...u16(42), ...u32(8)];
  const extra: number[] = [];
  const dataStart = 8 + 2 + entries.length * 12 + 4;
  const ifd = [...u16(entries.length)];
  for (const [tag, type, count, value] of entries) {
    ifd.push(...u16(tag), ...u16(type), ...u32(count));
    if (typeof value === 'string') {
      ifd.push(...u32(dataStart + extra.length));
      extra.push(...ascii(value));
    } else {
      ifd.push(...u16(value), 0, 0);
    }
  }
  return [...ascii('Exif\0\0'), ...tiff, ...ifd, ...u32(0), ...extra];
}
