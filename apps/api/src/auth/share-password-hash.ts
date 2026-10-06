// Share-password storage (docs/specs/013-workspace/share-password.md "Stored hashed"). The column holds
// `pbkdf2-sha256$<iterations>$<salt>$<hash>`; a value without that prefix is a
// password saved before hashing shipped, still accepted (compared in constant
// time) until its first correct entry rewrites it.

import { base64ToBytes, bytesToBase64Url } from '@livediagram/api-schema';
import { timingSafeEqual } from './timing-safe';

const PREFIX = 'pbkdf2-sha256';

// Measured at about 16 ms per derivation in V8's WebCrypto (Node 22, loaded dev machine):
// paid once per isolate per password thanks to the verified cache in
// share-access.ts, and a real cost to anyone holding a copy of the table.
export const SHARE_PASSWORD_ITERATIONS = 100_000;

// A stored value outside this range is refused rather than derived: a corrupt
// or hostile row must not make every check burn seconds of CPU.
export const MIN_STORED_ITERATIONS = 1_000;
export const MAX_STORED_ITERATIONS = 1_000_000;

const SALT_BYTES = 16;
const KEY_BITS = 256;

async function derive(password: string, salt: Uint8Array, iterations: number): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations },
    key,
    KEY_BITS,
  );
  return bytesToBase64Url(bits);
}

export function isHashedSharePassword(stored: string): boolean {
  return stored.startsWith(`${PREFIX}$`);
}

export async function hashSharePassword(
  password: string,
  iterations = SHARE_PASSWORD_ITERATIONS,
): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const hash = await derive(password, salt, iterations);
  return `${PREFIX}$${iterations}$${bytesToBase64Url(salt)}$${hash}`;
}

// `ok` when `provided` is the password `stored` was made from. `legacy` marks
// a plain-text stored value, which the caller rewrites as a hash after a
// correct entry. A malformed hashed value never matches.
export async function verifySharePassword(
  stored: string,
  provided: string,
): Promise<{ ok: boolean; legacy: boolean }> {
  if (!isHashedSharePassword(stored)) {
    return { ok: await timingSafeEqual(provided, stored), legacy: true };
  }
  const [, iterText, saltText, hash] = stored.split('$');
  const iterations = Number(iterText);
  const salt = saltText ? base64ToBytes(saltText) : null;
  if (
    !Number.isInteger(iterations) ||
    iterations < MIN_STORED_ITERATIONS ||
    iterations > MAX_STORED_ITERATIONS ||
    !salt ||
    salt.length === 0 ||
    !hash
  ) {
    console.warn('[share-password] malformed stored hash refused');
    return { ok: false, legacy: false };
  }
  return {
    ok: await timingSafeEqual(await derive(provided, salt, iterations), hash),
    legacy: false,
  };
}
