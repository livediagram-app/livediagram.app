// A secret sealed at rest with AES-GCM: the Drive mirror's Google refresh tokens (liveworkspace/docs/specs/005-drive/
// drive.md "Tokens") and webhooks' URLs and signing secrets (liveworkspace/docs/specs/004-index/webhooks.md "Security").
//
// The key is a Worker secret, base64 of 32 bytes. Each seal takes a fresh 12-byte IV and binds `context` (the person's
// id, the webhook's id) in as additional authenticated data, so a sealed value copied onto another row fails to open
// rather than handing over someone else's secret. Stored as `v1.<iv>.<ciphertext>`, both base64url, so a later key or
// algorithm change has a version to key on.

import { base64ToBytes, bytesToBase64Url } from './bytes';

const VERSION = 'v1';
const IV_BYTES = 12;
const KEY_BYTES = 32;
const enc = new TextEncoder();
const dec = new TextDecoder();

/** The raw key bytes, or null when the secret is absent or not 32 bytes of base64 (or base64url). */
export function sealKeyBytes(secret: string | undefined): Uint8Array<ArrayBuffer> | null {
  if (!secret) return null;
  const bytes = base64ToBytes(secret.trim());
  return bytes && bytes.length === KEY_BYTES ? new Uint8Array(bytes) : null;
}

/** The AES-GCM key, or null when the secret won't do. */
export async function importSealKey(secret: string | undefined): Promise<CryptoKey | null> {
  const bytes = sealKeyBytes(secret);
  if (!bytes) return null;
  return crypto.subtle.importKey('raw', bytes, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}

export async function seal(key: CryptoKey, context: string, plain: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData: enc.encode(context) },
    key,
    enc.encode(plain),
  );
  return `${VERSION}.${bytesToBase64Url(iv)}.${bytesToBase64Url(ciphertext)}`;
}

/** The plain text, or null for anything that doesn't open: another context, another key, a tampered value. */
export async function unseal(
  key: CryptoKey,
  context: string,
  sealed: string,
): Promise<string | null> {
  const [version, ivText, bodyText] = sealed.split('.');
  if (version !== VERSION || !ivText || !bodyText) return null;
  const iv = base64ToBytes(ivText);
  const body = base64ToBytes(bodyText);
  if (!iv || iv.length !== IV_BYTES || !body) return null;
  try {
    const plain = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: new Uint8Array(iv), additionalData: enc.encode(context) },
      key,
      new Uint8Array(body),
    );
    return dec.decode(plain);
  } catch {
    return null;
  }
}
