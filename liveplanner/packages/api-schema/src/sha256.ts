// Canonical SHA-256 hex digest, shared by the api worker (token, share-password and tag hashes) and the
// CLI, so every side produces byte-for-byte identical output.
//
// Implementation: `sha256` from @liveplanner/items, Web Crypto wherever the
// runtime has it (Node 22+, Cloudflare Workers, a secure browser page) and the
// same digest in plain code in a page that is not a secure context
// (docs/specs/016-platform/secure-context.md). Lowercase hex output,
// 64 chars, no separator.

import { sha256 } from '@liveplanner/items';
import { bytesToBase64Url } from './bytes';

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

// The OAuth PKCE S256 code challenge for a verifier (RFC 7636 section 4.2): the
// base64url SHA-256 of its ASCII bytes. The CLI computes it and the MCP server
// checks it, so both take it from here and cannot drift.
export async function pkceChallenge(verifier: string): Promise<string> {
  const digest = await sha256(new TextEncoder().encode(verifier));
  return bytesToBase64Url(digest);
}
