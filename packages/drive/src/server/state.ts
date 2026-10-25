// The consent `state` (liveworkspace/docs/drive.md "Connecting"). The service mints it before the browser leaves
// for Google and checks it when the code comes back, so a code can only be redeemed by the person who asked for it,
// against the redirect URI it was issued for, within ten minutes, and the browser returns only to the page it named.
// Signed with HMAC-SHA256 under a key derived from DRIVE_TOKEN_KEY by HKDF, so the key that seals refresh tokens is
// never itself used to sign.

import { base64ToBytes, bytesToBase64Url, randomBase64Url } from '../base64';
import { DRIVE_STATE_TTL_MS } from '../constants';
import { driveKeyBytes } from './crypto';

const enc = new TextEncoder();
const dec = new TextDecoder();

export type DriveState = { sub: string; redirectUri: string; returnTo: string; exp: number; nonce: string };

async function signingKey(secret: string, usage: 'sign' | 'verify'): Promise<CryptoKey | null> {
  const raw = driveKeyBytes(secret);
  if (!raw) return null;
  const base = await crypto.subtle.importKey('raw', raw, 'HKDF', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'HKDF', hash: 'SHA-256', salt: new Uint8Array(0), info: enc.encode('liveworkspace drive state') },
    base,
    { name: 'HMAC', hash: 'SHA-256', length: 256 },
    false,
    [usage],
  );
}

export async function signDriveState(
  secret: string,
  input: { sub: string; redirectUri: string; returnTo: string },
  now: number,
): Promise<string> {
  const key = await signingKey(secret, 'sign');
  if (!key) throw new Error('DRIVE_TOKEN_KEY is not a 32-byte base64 key');
  const payload: DriveState = { ...input, exp: now + DRIVE_STATE_TTL_MS, nonce: randomBase64Url(16) };
  const body = bytesToBase64Url(enc.encode(JSON.stringify(payload)));
  return `${body}.${bytesToBase64Url(await crypto.subtle.sign('HMAC', key, enc.encode(body)))}`;
}

/** The state's payload, or null: malformed, forged, another person's, or expired. The signature check is
 *  `crypto.subtle.verify`, constant-time. */
export async function verifyDriveState(
  secret: string,
  state: string,
  sub: string,
  now: number,
): Promise<DriveState | null> {
  const [body, sig] = state.split('.');
  if (!body || !sig) return null;
  const key = await signingKey(secret, 'verify');
  const sigBytes = base64ToBytes(sig);
  if (!key || !sigBytes) return null;
  if (!(await crypto.subtle.verify('HMAC', key, new Uint8Array(sigBytes), enc.encode(body)))) return null;
  const bytes = base64ToBytes(body);
  if (!bytes) return null;
  let payload: Partial<DriveState>;
  try {
    payload = JSON.parse(dec.decode(bytes)) as Partial<DriveState>;
  } catch {
    return null;
  }
  if (
    payload.sub !== sub ||
    typeof payload.exp !== 'number' ||
    payload.exp < now ||
    typeof payload.redirectUri !== 'string' ||
    typeof payload.returnTo !== 'string' ||
    typeof payload.nonce !== 'string'
  ) {
    return null;
  }
  return payload as DriveState;
}
