// JPEG metadata stripper. Walks the segment stream and drops every
// APP0 / APP1 (Exif) / APP2 (ICC profile) / APPn / COM marker the
// file carries, leaving only the image-data segments needed to
// render. Pure byte-level rewrite: no JPEG decode, no re-encode,
// the rendered pixels stay bit-identical. See docs/specs/009-elements/images.md + the
// security audit thread that drove this.
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
// stuffed 0xFF inside the stream); we copy everything from SOS
// forward verbatim, which preserves the image bytes exactly.

const SOI = 0xd8;
const EOI = 0xd9;
const SOS = 0xda; // Start of Scan — switches to raw entropy-coded stream.

// Segments to drop (no payload survives to R2):
//   APPn  0xE0..0xEF: JFIF (E0), Exif (E1), ICC (E2), Photoshop
//                    (ED), Adobe (EE), GoPro / camera junk (E3..EF).
//   COM   0xFE: comment field.
function shouldStrip(marker: number): boolean {
  return (marker >= 0xe0 && marker <= 0xef) || marker === 0xfe;
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

  // Output buffer sized to the input length; we only ever remove
  // bytes so the source size is a safe upper bound. Trim before
  // returning.
  const out = new Uint8Array(src.length);
  let outOffset = 0;

  // Copy SOI verbatim.
  out[outOffset++] = 0xff;
  out[outOffset++] = SOI;
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
      // End of image: copy and stop.
      out[outOffset++] = 0xff;
      out[outOffset++] = EOI;
      break;
    }

    if (marker === SOS) {
      // Start of scan: copy the SOS segment + every remaining byte
      // verbatim through EOI. The entropy-coded stream has no
      // length prefix, so the only safe thing is "copy until end".
      out[outOffset++] = 0xff;
      out[outOffset++] = SOS;
      while (i < src.length) out[outOffset++] = src[i++]!;
      break;
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

    if (!shouldStrip(marker)) {
      // Keep the segment: copy marker + payload.
      out[outOffset++] = 0xff;
      out[outOffset++] = marker;
      for (let k = segStart; k < segEnd; k++) out[outOffset++] = src[k]!;
    }
    // Else: skip the segment entirely (marker + payload elided).

    i = segEnd;
  }

  return out.slice(0, outOffset).buffer as ArrayBuffer;
}
