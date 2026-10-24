// Share-password storage, as liveplanner keeps it (liveplanner/apps/api/src/auth/share-password-hash.ts):
// `pbkdf2-sha256$<iterations>$<salt>$<hash>`. The index starts empty, so there are no plain-text values
// to accept. A correct check is remembered per isolate, so PBKDF2's cost is paid once per password.

import { PASSWORD_MEMORY_MAX } from './config';
import { base64UrlToBytes, bytesToBase64Url } from './codec';
import { timingSafeEqual } from '@liveworkspace/index-app/timing-safe';

const PREFIX = 'pbkdf2-sha256';
// About 16 ms per derivation in V8's WebCrypto.
export const SHARE_PASSWORD_ITERATIONS = 100_000;
// A stored value outside this range is refused rather than derived: a corrupt row must not make every
// check burn seconds of CPU.
const MIN_STORED_ITERATIONS = 1_000;
const MAX_STORED_ITERATIONS = 1_000_000;
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
    { name: 'PBKDF2', hash: 'SHA-256', salt: salt as BufferSource, iterations },
    key,
    KEY_BITS,
  );
  return bytesToBase64Url(bits);
}

export async function hashSharePassword(
  password: string,
  iterations = SHARE_PASSWORD_ITERATIONS,
): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const hash = await derive(password, salt, iterations);
  return `${PREFIX}$${iterations}$${bytesToBase64Url(salt)}$${hash}`;
}

// Checked (stored, provided) pairs, by a digest of both: never the password itself. Oldest out first.
const verified = new Set<string>();

async function memoryKey(stored: string, provided: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(`${stored}\u0000${provided}`),
  );
  return bytesToBase64Url(digest);
}

export async function verifySharePassword(stored: string, provided: string): Promise<boolean> {
  const key = await memoryKey(stored, provided);
  if (verified.has(key)) return true;
  const [prefix, iterText, saltText, hash] = stored.split('$');
  const iterations = Number(iterText);
  const salt = saltText ? base64UrlToBytes(saltText) : null;
  if (
    prefix !== PREFIX ||
    !Number.isInteger(iterations) ||
    iterations < MIN_STORED_ITERATIONS ||
    iterations > MAX_STORED_ITERATIONS ||
    !salt ||
    salt.length === 0 ||
    !hash
  ) {
    console.warn('[index] malformed stored share password refused');
    return false;
  }
  const ok = await timingSafeEqual(await derive(provided, salt, iterations), hash);
  if (ok) {
    if (verified.size >= PASSWORD_MEMORY_MAX) {
      const oldest = verified.values().next().value;
      if (oldest !== undefined) verified.delete(oldest);
    }
    verified.add(key);
  }
  return ok;
}
