// JPEG metadata stripper. Walks the segment stream and drops every
// APPn and COM marker the file carries (Exif with its GPS and camera
// serial, XMP, Photoshop, maker notes), keeping only what changes how
// the picture looks: the ICC colour profile (APP2 `ICC_PROFILE`), the
// Adobe colour transform (APP14 `Adobe`) and, from the Exif, its
// Orientation alone, written back as a minimal Exif segment of one tag
// (a phone's portrait photo is stored sideways with Orientation 6).
// Pure byte-level rewrite: no JPEG decode, no re-encode, the rendered
// pixels stay bit-identical. See liveworkspace/docs/specs/006-media/media.md
// "Uploads" and the security audit thread that drove this.
//
// JPEG layout (from JFIF / EXIF specs):
//   SOI  FFD8                                  start of image
//   SEG  FFE0..FFEF  <len lo><len hi> <data>   application-specific
//   SEG  FFFE        <len lo><len hi> <data>   comment
//   SEG  FFDB        <len lo><len hi> <data>   quantisation table
//   SEG  ...         <len lo><len hi> <data>   other tables / SOFs
//   SOS  FFDA        <len lo><len hi> <data>   start of scan (header)
//   ECS              <raw entropy-coded data>  pixel data (no length!)
//   EOI  FFD9                                  end of image
//
// Length bytes are BIG-ENDIAN and include the two length bytes
// themselves but NOT the marker. The scan stream after SOS is
// length-less raw bytes terminated by FFD9 (with FF00 being a
// stuffed 0xFF inside the stream); we copy each scan verbatim, which
// preserves the image bytes exactly, and walk on past it: a progressive
// JPEG's later scans can carry APPn and COM between them. Nothing after
// EOI is kept: a phone's second picture (MPF, a gain map) with its own
// Exif and GPS, or a motion photo's video, would carry them past us.

const SOI = 0xd8;
const EOI = 0xd9;
const SOS = 0xda; // Start of Scan — switches to raw entropy-coded stream.

const APP1 = 0xe1;
const APP2 = 0xe2;
const APP14 = 0xee;

const ascii = (text: string) => Array.from(text, (c) => c.charCodeAt(0));
const EXIF_ID = ascii('Exif\0\0');
const ICC_ID = ascii('ICC_PROFILE\0');
const ADOBE_ID = ascii('Adobe');
const ORIENTATION_TAG = 0x0112;
const SHORT = 3;

// Whether the segment's payload (after its length bytes) opens with `id`.
function opensWith(src: Uint8Array, payloadStart: number, payloadEnd: number, id: number[]) {
  if (payloadEnd - payloadStart < id.length) return false;
  return id.every((byte, k) => src[payloadStart + k] === byte);
}

// Segments kept as they are: an ICC profile chunk (APP2, possibly several in a row) and the
// Adobe segment (APP14, which says whether a CMYK picture's channels are transformed). Every
// other APPn (JFIF, Exif, XMP, MPF, Photoshop, camera junk in E3..EF) and COM goes.
function isKeptAppSegment(marker: number, src: Uint8Array, start: number, end: number): boolean {
  if (marker === APP2) return opensWith(src, start, end, ICC_ID);
  if (marker === APP14) return opensWith(src, start, end, ADOBE_ID);
  return false;
}

function isMetadata(marker: number): boolean {
  return (marker >= 0xe0 && marker <= 0xef) || marker === 0xfe;
}

/**
 * The Orientation (2..8) an Exif APP1 payload's first IFD holds, or null: none, the default 1,
 * or an Exif too broken to read (never an error: the picture is fine without it).
 */
export function exifOrientation(src: Uint8Array, start: number, end: number): number | null {
  if (!opensWith(src, start, end, EXIF_ID)) return null;
  const tiff = start + EXIF_ID.length;
  if (tiff + 8 > end) return null;
  const little = src[tiff] === 0x49 && src[tiff + 1] === 0x49; // "II"
  const big = src[tiff] === 0x4d && src[tiff + 1] === 0x4d; // "MM"
  if (!little && !big) return null;
  const u16 = (at: number) =>
    little ? src[at]! | (src[at + 1]! << 8) : (src[at]! << 8) | src[at + 1]!;
  const u32 = (at: number) =>
    little
      ? (src[at]! | (src[at + 1]! << 8) | (src[at + 2]! << 16) | (src[at + 3]! << 24)) >>> 0
      : ((src[at]! << 24) | (src[at + 1]! << 16) | (src[at + 2]! << 8) | src[at + 3]!) >>> 0;
  if (u16(tiff + 2) !== 42) return null;
  const ifd = tiff + u32(tiff + 4);
  if (ifd + 2 > end) return null;
  const entries = u16(ifd);
  for (let n = 0; n < entries; n++) {
    const entry = ifd + 2 + n * 12;
    if (entry + 12 > end) return null;
    if (u16(entry) !== ORIENTATION_TAG) continue;
    if (u16(entry + 2) !== SHORT || u32(entry + 4) !== 1) return null;
    const value = u16(entry + 8);
    return value >= 2 && value <= 8 ? value : null;
  }
  return null;
}

/** A minimal Exif APP1 segment (marker included) holding the Orientation tag alone. */
export function orientationSegment(orientation: number): number[] {
  const payload = [
    ...EXIF_ID,
    // TIFF header, big-endian: "MM", 42, the first IFD at offset 8.
    0x4d,
    0x4d,
    0x00,
    0x2a,
    0x00,
    0x00,
    0x00,
    0x08,
    // IFD0: one entry, Orientation, SHORT, count 1, the value left-justified in its four bytes.
    0x00,
    0x01,
    0x01,
    0x12,
    0x00,
    SHORT,
    0x00,
    0x00,
    0x00,
    0x01,
    0x00,
    orientation & 0xff,
    0x00,
    0x00,
    // No next IFD.
    0x00,
    0x00,
    0x00,
    0x00,
  ];
  const len = payload.length + 2;
  return [0xff, APP1, (len >> 8) & 0xff, len & 0xff, ...payload];
}

// Strip metadata from a JPEG byte buffer. Returns the rewritten
// buffer. If the input doesn't start with the JPEG SOI marker (i.e.
// it's not a JPEG at all), returns the input unchanged (callers
// should only pass JPEG content but defence in depth doesn't hurt).
//
// Throws when the input is structurally invalid mid-walk so the
// upload endpoint can fail loudly rather than store a half-parsed
// file. Returning the original would silently leak the very
// metadata we're trying to remove.
export function stripJpegMetadata(input: ArrayBuffer): ArrayBuffer {
  const src = new Uint8Array(input);
  if (src.length < 4 || src[0] !== 0xff || src[1] !== SOI) {
    return input; // Not a JPEG: hand back unchanged.
  }

  // Output buffer sized to the input length plus room for the one
  // Orientation segment written back; everything else only removes
  // bytes. Trim before returning.
  const out = new Uint8Array(src.length + orientationSegment(1).length);
  let outOffset = 0;
  let orientation: number | null = null;
  let sawExif = false;

  // Copy SOI verbatim; the Orientation segment, when the Exif held
  // one, goes straight after it (where readers look for Exif) once
  // the walk has found it.
  out[outOffset++] = 0xff;
  out[outOffset++] = SOI;
  const afterSoi = outOffset;
  let i = 2;

  while (i < src.length) {
    // Every marker starts with 0xFF. Multiple 0xFFs in a row are
    // marker fill (used for alignment / padding); skip until the
    // first non-FF byte.
    if (src[i] !== 0xff) {
      throw new Error(
        `stripJpegMetadata: expected marker at offset ${i}, got 0x${src[i]!.toString(16)}`,
      );
    }
    while (i < src.length && src[i] === 0xff) i++;
    if (i >= src.length) {
      throw new Error('stripJpegMetadata: truncated input, expected marker code');
    }
    const marker = src[i]!;
    i++;

    if (marker === EOI) {
      // End of image: copy and stop. What follows (another picture, a video) is dropped.
      out[outOffset++] = 0xff;
      out[outOffset++] = EOI;
      break;
    }

    if (marker === SOS) {
      // Start of scan: its header, then the entropy-coded stream, copied verbatim. The stream has no
      // length; it ends at the first 0xFF that isn't a stuffed byte (FF00), a restart marker (FFD0..FFD7)
      // or fill (FFFF). The walk goes on from there: a progressive JPEG's later scans, the tables and
      // metadata between them, and EOI. A stream that never ends (no EOI) is copied to the end of the file.
      if (i + 1 >= src.length) {
        throw new Error('stripJpegMetadata: truncated input, expected scan header length');
      }
      const headerEnd = i + ((src[i]! << 8) | src[i + 1]!);
      if (headerEnd > src.length) throw new Error('stripJpegMetadata: scan header overruns input');
      let end = headerEnd;
      for (;;) {
        end = src.indexOf(0xff, end);
        if (end < 0 || end + 1 >= src.length) {
          end = src.length;
          break;
        }
        const next = src[end + 1]!;
        if (next === 0x00 || (next >= 0xd0 && next <= 0xd7)) end += 2;
        else if (next === 0xff) end += 1;
        else break;
      }
      out[outOffset++] = 0xff;
      out[outOffset++] = SOS;
      out.set(src.subarray(i, end), outOffset);
      outOffset += end - i;
      i = end;
      continue;
    }

    // Markers without a payload (RST0..RST7, TEM). No length, no
    // data: just the two-byte marker. We don't strip those.
    if (marker >= 0xd0 && marker <= 0xd7) {
      out[outOffset++] = 0xff;
      out[outOffset++] = marker;
      continue;
    }

    // Every other marker is length-prefixed (big-endian 16-bit,
    // inclusive of the length bytes themselves).
    if (i + 1 >= src.length) {
      throw new Error('stripJpegMetadata: truncated input, expected segment length');
    }
    const len = (src[i]! << 8) | src[i + 1]!;
    if (len < 2) {
      throw new Error(`stripJpegMetadata: invalid segment length ${len} at offset ${i}`);
    }
    const segStart = i; // points at length bytes
    const segEnd = i + len; // exclusive
    if (segEnd > src.length) {
      throw new Error('stripJpegMetadata: segment overruns input');
    }

    // The first Exif segment is the one readers honour.
    if (marker === APP1 && !sawExif && opensWith(src, segStart + 2, segEnd, EXIF_ID)) {
      sawExif = true;
      orientation = exifOrientation(src, segStart + 2, segEnd);
    }

    if (!isMetadata(marker) || isKeptAppSegment(marker, src, segStart + 2, segEnd)) {
      // Keep the segment: copy marker + payload.
      out[outOffset++] = 0xff;
      out[outOffset++] = marker;
      out.set(src.subarray(segStart, segEnd), outOffset);
      outOffset += segEnd - segStart;
    }
    // Else: skip the segment entirely (marker + payload elided).

    i = segEnd;
  }

  if (orientation === null) return out.slice(0, outOffset).buffer;
  const segment = orientationSegment(orientation);
  const result = new Uint8Array(outOffset + segment.length);
  result.set(out.subarray(0, afterSoi), 0);
  result.set(segment, afterSoi);
  result.set(out.subarray(afterSoi, outOffset), afterSoi + segment.length);
  return result.buffer;
}
