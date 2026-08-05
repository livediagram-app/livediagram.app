// Magic-number sniffing for image uploads. A malicious client could
// send Content-Type: image/png with an SVG body, smuggling an XSS
// surface in through the front door (SVG is XML and can carry
// inline <script>). Match the first bytes against each format's
// signature so the declared content-type is independently verified
// at the api boundary before the bytes ever reach R2.
//
// Sits in its own module (alongside image-strip.ts) so the security
// boundary can be exercised in isolation by image-sniff.test.ts;
// importing it via index.ts would pull the whole worker handler
// into the test runtime.

// The accepted list itself lives in api-schema: the api serialises it in its
// 415 body, so it's wire contract the editor reads too. Re-exported here
// because every caller of `sniffImageType` wants the pair together, and the
// sniffer's whole job is deciding which member of this list the bytes are.
export { ACCEPTED_IMAGE_TYPES, type AcceptedImageType } from '@livediagram/api-schema';
import type { AcceptedImageType } from '@livediagram/api-schema';

export function sniffImageType(buf: Uint8Array): AcceptedImageType | null {
  if (buf.length < 12) return null;
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47 &&
    buf[4] === 0x0d &&
    buf[5] === 0x0a &&
    buf[6] === 0x1a &&
    buf[7] === 0x0a
  ) {
    return 'image/png';
  }
  // JPEG: FF D8 FF
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  // GIF: "GIF87a" or "GIF89a"
  if (
    buf[0] === 0x47 &&
    buf[1] === 0x49 &&
    buf[2] === 0x46 &&
    buf[3] === 0x38 &&
    (buf[4] === 0x37 || buf[4] === 0x39) &&
    buf[5] === 0x61
  ) {
    return 'image/gif';
  }
  // WebP: "RIFF" .... "WEBP"
  if (
    buf[0] === 0x52 &&
    buf[1] === 0x49 &&
    buf[2] === 0x46 &&
    buf[3] === 0x46 &&
    buf[8] === 0x57 &&
    buf[9] === 0x45 &&
    buf[10] === 0x42 &&
    buf[11] === 0x50
  ) {
    return 'image/webp';
  }
  return null;
}
