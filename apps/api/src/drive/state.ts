// The consent `state` (docs/specs/022-drive-mirror/drive-mirror.md, "Connecting").
//
// The api mints it before the browser leaves for Google and checks it when
// the code comes back, so a code can only be redeemed by the user who asked
// for it, against the redirect URI it was issued for, within ten minutes.
// Signed with HMAC-SHA256 under a key derived from DRIVE_TOKEN_KEY by HKDF,
// so the key that seals refresh tokens is never itself used to sign.

import {
  base64ToBytes,
  bytesToBase64Url,
  DRIVE_STATE_TTL_MS,
  isLoopbackHostname,
} from '@livediagram/api-schema';
import { timingSafeEqual } from '../auth/timing-safe';
import { driveKeyBytes } from './crypto';

const enc = new TextEncoder();
const dec = new TextDecoder();
const REDIRECT_PATH = '/drive/connected';

type StatePayload = { sub: string; redirectUri: string; exp: number; nonce: string };

async function signingKey(secret: string): Promise<CryptoKey | null> {
  const raw = driveKeyBytes(secret);
  if (!raw) return null;
  const base = await crypto.subtle.importKey('raw', raw, 'HKDF', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: new Uint8Array(0),
      info: enc.encode('livediagram drive state'),
    },
    base,
    { name: 'HMAC', hash: 'SHA-256', length: 256 },
    false,
    ['sign'],
  );
}

async function signature(key: CryptoKey, payload: string): Promise<string> {
  return bytesToBase64Url(await crypto.subtle.sign('HMAC', key, enc.encode(payload)));
}

// Where Google may send the code: `/drive/connected` on https, or on http for
// a loopback host (local development), with no query or fragment.
export function isAllowedRedirectUri(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  if (url.pathname !== REDIRECT_PATH || url.search !== '' || url.hash !== '') return false;
  if (url.protocol === 'https:') return true;
  return url.protocol === 'http:' && isLoopbackHostname(url.hostname);
}

export async function signDriveState(
  secret: string,
  sub: string,
  redirectUri: string,
  now: number,
): Promise<string> {
  const key = await signingKey(secret);
  if (!key) throw new Error('DRIVE_TOKEN_KEY is not a 32-byte base64 key');
  const payload: StatePayload = {
    sub,
    redirectUri,
    exp: now + DRIVE_STATE_TTL_MS,
    nonce: bytesToBase64Url(crypto.getRandomValues(new Uint8Array(16))),
  };
  const body = bytesToBase64Url(enc.encode(JSON.stringify(payload)));
  return `${body}.${await signature(key, body)}`;
}

// The redirect URI the state was issued for, or null: malformed, forged,
// another user's, or expired.
export async function verifyDriveState(
  secret: string,
  state: string,
  sub: string,
  now: number,
): Promise<string | null> {
  const [body, sig] = state.split('.');
  if (!body || !sig) return null;
  const key = await signingKey(secret);
  if (!key) return null;
  if (!(await timingSafeEqual(sig, await signature(key, body)))) return null;
  const bytes = base64ToBytes(body);
  if (!bytes) return null;
  let payload: Partial<StatePayload>;
  try {
    payload = JSON.parse(dec.decode(bytes)) as Partial<StatePayload>;
  } catch {
    return null;
  }
  if (payload.sub !== sub || typeof payload.exp !== 'number' || payload.exp < now) return null;
  return isAllowedRedirectUri(payload.redirectUri) ? payload.redirectUri : null;
}
