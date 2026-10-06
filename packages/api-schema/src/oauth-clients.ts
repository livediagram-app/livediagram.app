// The OAuth clients livediagram ships itself, and the device grant's user codes (docs/specs/015-api/blueprints/cli.md
// "OAuth server", "The CLI's OAuth client", CLI35, CLI36). Shared by the MCP worker's authorization server, the
// editor's /oauth/device page and the CLI.

export const CLI_CLIENT_ID = 'livediagram-cli';
export const CLI_CLIENT_NAME = 'livediagram CLI';
// Loopback callbacks, matched on any port (RFC 8252 §7.3).
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
