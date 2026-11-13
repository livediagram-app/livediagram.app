// Canonical SHA-256 hex digest used as the image dedupe key (see
// docs/specs/009-elements/images.md): the live editor computes it from the file bytes before
// posting to /api/images, stamps it on the `X-Image-Sha256` request
// header, and the api worker re-hashes the body to verify. Both
// sides have to produce byte-for-byte identical output or the
// server rejects every legitimate upload with a hash mismatch, so
// the function lives here alongside the wire-format types it backs.
//
// Implementation: `sha256` from @liveworkspace/model-core/sha256, Web Crypto wherever the
// runtime has it (Node 22+, Cloudflare Workers, a secure browser page) and the
// same digest in plain code in a page that is not a secure context
// (docs/specs/016-platform/secure-context.md). Lowercase hex output,
// 64 chars, no separator: matches the `images.sha256` column shape
// in the api worker's D1 schema.

import { sha256, sha256Fallback } from '@liveworkspace/model-core/sha256';

function bytesToHex(buf: Uint8Array): string {
  let out = '';
  for (let i = 0; i < buf.length; i++) {
    const v = buf[i]!;
    out += (v < 16 ? '0' : '') + v.toString(16);
  }
  return out;
}

export async function sha256Hex(bytes: BufferSource): Promise<string> {
  return bytesToHex(await sha256(bytes));
}

/** The same digest at once, in plain code: for a caller that cannot wait for Web Crypto (the unload flush's delta,
 *  livediagram's docs/specs/006-document/delta-saves.md "Unload"). */
export function sha256HexSync(bytes: Uint8Array): string {
  return bytesToHex(sha256Fallback(bytes));
}
