// Canonical SHA-256 hex digest used as the image dedupe key (see
// spec/19): the live editor computes it from the file bytes before
// posting to /api/images, stamps it on the `X-Image-Sha256` request
// header, and the api worker re-hashes the body to verify. Both
// sides have to produce byte-for-byte identical output or the
// server rejects every legitimate upload with a hash mismatch, so
// the function lives here alongside the wire-format types it backs.
//
// Implementation: Web Crypto's `crypto.subtle.digest('SHA-256', ...)`
// is available in every runtime this monorepo targets (modern
// browsers + Node 22+ + Cloudflare Workers). Lowercase hex output,
// 64 chars, no separator: matches the `images.sha256` column shape
// in the api worker's D1 schema.

function bytesToHex(buf: Uint8Array): string {
  let out = '';
  for (let i = 0; i < buf.length; i++) {
    const v = buf[i]!;
    out += (v < 16 ? '0' : '') + v.toString(16);
  }
  return out;
}

export async function sha256Hex(bytes: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return bytesToHex(new Uint8Array(digest));
}
