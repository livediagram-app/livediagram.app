// Base64 encoders for raw bytes, shared by the api and mcp workers and the
// live editor. Worker-safe: `btoa` + `String.fromCharCode` only, no Node
// Buffer, so the same code runs in Cloudflare Workers, browsers, and Node.
// Each app used to carry its own copy (image data URLs, font embedding, the
// PNG encoder, OAuth PKCE, HMAC and token encoding), and the copies had
// already split into chunked and byte-at-a-time variants.

// Chunk size for the String.fromCharCode spread: large enough to be fast,
// small enough that a multi-megabyte image can't blow the argument limit.
const CHUNK = 0x8000;

// Standard base64 (with `+`, `/`, and `=` padding), as a `data:` URL wants.
export function bytesToBase64(bytes: Uint8Array | ArrayBuffer): string {
  const u = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let binary = '';
  for (let i = 0; i < u.length; i += CHUNK) {
    binary += String.fromCharCode(...u.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

// URL-safe base64 with no padding (RFC 4648 §5): what OAuth PKCE challenges,
// HMAC signatures in a header, and `lvd_` API tokens are spelled in.
export function bytesToBase64Url(bytes: Uint8Array | ArrayBuffer): string {
  return bytesToBase64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

const BASE64_RE = /^[A-Za-z0-9+/_-]*={0,2}$/;

// Either alphabet, padding optional: the inverse of both encoders above. Null
// for anything that is not base64, so a caller decoding untrusted input (a
// secret from the environment, a sealed value from a row) can refuse it
// rather than throw.
export function base64ToBytes(text: string): Uint8Array | null {
  if (!BASE64_RE.test(text)) return null;
  const standard = text.replace(/-/g, '+').replace(/_/g, '/').replace(/=+$/, '');
  const padded = standard + '='.repeat((4 - (standard.length % 4)) % 4);
  try {
    return Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
  } catch {
    return null;
  }
}
