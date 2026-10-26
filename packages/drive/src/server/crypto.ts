// Sealing the Google refresh token at rest (liveworkspace/docs/specs/005-drive/drive.md "Tokens").
//
// AES-GCM under DRIVE_TOKEN_KEY (base64 of 32 bytes), a fresh 12-byte IV per seal, and the person's id as
// additional authenticated data: a sealed value copied onto another person's store fails to open rather than
// handing them someone else's Google access. Stored as `v1.<iv>.<ciphertext>`, both base64url, so a later key or
// algorithm change has a version to key on.

import { base64ToBytes, bytesToBase64Url } from '../base64';

const VERSION = 'v1';
const IV_BYTES = 12;
const KEY_BYTES = 32;
const enc = new TextEncoder();
const dec = new TextDecoder();

/** The raw key bytes, or null when the secret is absent or not 32 bytes of base64. */
export function driveKeyBytes(secret: string | undefined): Uint8Array<ArrayBuffer> | null {
  if (!secret) return null;
  const bytes = base64ToBytes(secret.trim());
  return bytes && bytes.length === KEY_BYTES ? new Uint8Array(bytes) : null;
}

export async function importDriveKey(secret: string | undefined): Promise<CryptoKey | null> {
  const bytes = driveKeyBytes(secret);
  if (!bytes) return null;
  return crypto.subtle.importKey('raw', bytes, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}

export async function sealRefreshToken(key: CryptoKey, personId: string, token: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData: enc.encode(personId) },
    key,
    enc.encode(token),
  );
  return `${VERSION}.${bytesToBase64Url(iv)}.${bytesToBase64Url(ciphertext)}`;
}

/** The token, or null for anything that doesn't open: another person, another key, a tampered value. */
export async function openRefreshToken(
  key: CryptoKey,
  personId: string,
  sealed: string,
): Promise<string | null> {
  const [version, ivText, bodyText] = sealed.split('.');
  if (version !== VERSION || !ivText || !bodyText) return null;
  const iv = base64ToBytes(ivText);
  const body = base64ToBytes(bodyText);
  if (!iv || iv.length !== IV_BYTES || !body) return null;
  try {
    const plain = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: new Uint8Array(iv), additionalData: enc.encode(personId) },
      key,
      new Uint8Array(body),
    );
    return dec.decode(plain);
  } catch {
    return null;
  }
}
