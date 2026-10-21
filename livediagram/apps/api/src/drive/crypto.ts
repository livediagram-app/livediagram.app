// Sealing the Google refresh token at rest (docs/specs/022-drive-mirror/drive-mirror.md,
// "Tokens"; blueprint "Data and persistence").
//
// AES-GCM under DRIVE_TOKEN_KEY (base64 of 32 bytes), a fresh 12-byte IV per
// seal, and the owner id as additional authenticated data: a sealed value
// copied onto another user's row fails to open rather than handing that user
// someone else's Google access. Stored as `v1.<iv>.<ciphertext>`, both
// base64url, so a later key or algorithm change has a version to key on.

import { base64ToBytes, bytesToBase64Url } from '@livediagram/api-schema';

const VERSION = 'v1';
const IV_BYTES = 12;
const KEY_BYTES = 32;
const enc = new TextEncoder();
const dec = new TextDecoder();

// The raw key bytes, or null when the value is absent or not 32 bytes of
// base64. Shared with state.ts, which derives its signing key from them.
export function driveKeyBytes(secret: string | undefined): Uint8Array | null {
  if (!secret) return null;
  const bytes = base64ToBytes(secret.trim());
  return bytes && bytes.length === KEY_BYTES ? bytes : null;
}

export async function importDriveKey(secret: string | undefined): Promise<CryptoKey | null> {
  const bytes = driveKeyBytes(secret);
  if (!bytes) return null;
  return crypto.subtle.importKey('raw', bytes, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}

export async function sealRefreshToken(
  key: CryptoKey,
  ownerId: string,
  refreshToken: string,
): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData: enc.encode(ownerId) },
    key,
    enc.encode(refreshToken),
  );
  return `${VERSION}.${bytesToBase64Url(iv)}.${bytesToBase64Url(ciphertext)}`;
}

// The token, or null for anything that does not open: another owner, another
// key, a tampered or malformed value.
export async function openRefreshToken(
  key: CryptoKey,
  ownerId: string,
  sealed: string,
): Promise<string | null> {
  const [version, ivText, bodyText] = sealed.split('.');
  if (version !== VERSION || !ivText || !bodyText) return null;
  const iv = base64ToBytes(ivText);
  const body = base64ToBytes(bodyText);
  if (!iv || iv.length !== IV_BYTES || !body) return null;
  try {
    const plain = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv, additionalData: enc.encode(ownerId) },
      key,
      body,
    );
    return dec.decode(plain);
  } catch {
    return null;
  }
}
