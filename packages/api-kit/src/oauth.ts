// The OAuth pieces every product's authorization server (its MCP Worker), CLI and editor's /oauth/device page
// share (each product's docs/specs/015-api/blueprints/cli.md "OAuth server", "The CLI's OAuth client", CLI35,
// CLI36): the device grant's constants and user codes, the built-in CLI client's callbacks, and the PKCE
// challenge. A product's own CLI client id and name stay in its api-schema.

import { bytesToBase64Url } from './bytes';

// The built-in CLI client's loopback callbacks, matched on any port (RFC 8252 §7.3).
export const CLI_REDIRECT_URIS: readonly string[] = [
  'http://127.0.0.1/callback',
  'http://[::1]/callback',
];

export const DEVICE_CODE_GRANT = 'urn:ietf:params:oauth:grant-type:device_code';
export const DEVICE_CODE_TTL_S = 600;
export const DEVICE_POLL_INTERVAL_S = 5;
export const DEVICE_SLOW_DOWN_S = 5;

// RFC 8628 §6.1: consonants only, so a code never spells a word, and none that read alike.
export const USER_CODE_ALPHABET = 'BCDFGHJKLMNPQRSTVWXZ';
export const USER_CODE_LENGTH = 8;

// A new user code from random bytes; the bias of `byte % 20` over 256 values is negligible for a 10-minute code.
export function newUserCode(randomBytes: (n: number) => Uint8Array): string {
  return [...randomBytes(USER_CODE_LENGTH)]
    .map((b) => USER_CODE_ALPHABET[b % USER_CODE_ALPHABET.length])
    .join('');
}

export const formatUserCode = (code: string) => `${code.slice(0, 4)}-${code.slice(4)}`;

// What a person typed, as the stored code: upper case, without hyphens or spaces.
export const normaliseUserCode = (typed: string) => typed.toUpperCase().replace(/[\s-]/g, '');

export function isUserCode(code: string): boolean {
  return code.length === USER_CODE_LENGTH && [...code].every((c) => USER_CODE_ALPHABET.includes(c));
}

// The OAuth PKCE S256 code challenge for a verifier (RFC 7636 §4.2): the base64url SHA-256 of its ASCII
// bytes. The CLI computes it and the MCP server checks it, so both take it from here and cannot drift. Web
// Crypto only: both run where `crypto.subtle` is (Node 22 and later, Cloudflare Workers).
export async function pkceChallenge(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  return bytesToBase64Url(digest);
}

// Schemes an app's own redirect may never use (liveworkspace/docs/specs/021-mcp/mcp.md "Redirect addresses"): ones a
// browser runs or reads itself, the system's own handlers, and the web's, which have rules of their own (https; http
// on loopback only).
const REFUSED_APP_SCHEMES = new Set([
  'javascript',
  'data',
  'file',
  'vbscript',
  'about',
  'blob',
  'filesystem',
  'ftp',
  'ws',
  'wss',
  'http',
  'https',
  'mailto',
  'tel',
  'sms',
  'intent',
  'content',
  'jar',
  'view-source',
  'chrome',
  'chrome-extension',
  'moz-extension',
  'edge',
  'resource',
]);

export const APP_REDIRECT_MAX_CHARS = 512;

const isSchemeChar = (ch: string, first: boolean) =>
  (ch >= 'a' && ch <= 'z') ||
  (!first && ((ch >= '0' && ch <= '9') || ch === '+' || ch === '.' || ch === '-'));

/**
 * An app's own redirect address (`cursor://anysphere.cursor-retrieval/oauth/callback`, `com.example.app:/cb`), or
 * null: a scheme of two or more letters, digits, `+`, `.` or `-` starting with a letter (one letter is a drive),
 * none of the refused ones, something after the colon, no fragment, white space or control character, at most 512
 * characters. Read one character at a time, no pattern, so a long address costs a single pass.
 */
export function appSchemeRedirectUrl(uri: string): URL | null {
  if (uri.length > APP_REDIRECT_MAX_CHARS || uri.includes('#')) return null;
  const colon = uri.indexOf(':');
  if (colon < 2 || colon === uri.length - 1) return null;
  for (let i = 0; i < uri.length; i++) {
    const code = uri.charCodeAt(i);
    if (code <= 0x20 || code === 0x7f) return null;
  }
  const scheme = uri.slice(0, colon).toLowerCase();
  for (let i = 0; i < scheme.length; i++) if (!isSchemeChar(scheme[i]!, i === 0)) return null;
  if (REFUSED_APP_SCHEMES.has(scheme)) return null;
  try {
    return new URL(uri);
  } catch {
    return null;
  }
}
