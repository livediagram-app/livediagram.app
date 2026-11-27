// The app's chat key (liveworkspace/docs/specs/023-chat-apps/chat-apps.md "Signed state", "Tokens are secrets"):
// one Worker secret, 32 bytes of base64, from which two keys are derived (HKDF-SHA-256), one that seals bot tokens
// at rest (AES-GCM, @liveworkspace/api-kit/sealed) and one that signs an install's state and an account link's code
// (HMAC-SHA-256), so neither use can stand in for the other. A signed payload is `<base64url json>.<base64url mac>`,
// its JSON carrying `exp` (ms); it is checked with `crypto.subtle.verify`, which compares in constant time.
import { base64ToBytes, bytesToBase64Url } from '@liveworkspace/api-kit/bytes';
import { sealKeyBytes } from '@liveworkspace/api-kit/sealed';
import { SIGNED_PAYLOAD_MAX } from './limits';

export type ChatKeys = { seal: CryptoKey; sign: CryptoKey };

const enc = new TextEncoder();
const dec = new TextDecoder();

/** The derived keys, or null when the secret is absent or not 32 bytes. */
export async function chatKeys(secret: string | undefined): Promise<ChatKeys | null> {
  const raw = sealKeyBytes(secret);
  if (!raw) return null;
  const base = await crypto.subtle.importKey('raw', raw, 'HKDF', false, ['deriveKey']);
  const params = (info: string): HkdfParams => ({
    name: 'HKDF',
    hash: 'SHA-256',
    salt: new Uint8Array(0),
    info: enc.encode(info),
  });
  const [seal, sign] = await Promise.all([
    crypto.subtle.deriveKey(
      params('liveworkspace-chat-seal'),
      base,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt'],
    ),
    crypto.subtle.deriveKey(
      params('liveworkspace-chat-sign'),
      base,
      { name: 'HMAC', hash: 'SHA-256', length: 256 },
      false,
      ['sign', 'verify'],
    ),
  ]);
  return { seal, sign };
}

/** A payload signed to `expiresAt` (ms). */
export async function signPayload(
  key: CryptoKey,
  payload: Record<string, unknown>,
  expiresAt: number,
): Promise<string> {
  const body = bytesToBase64Url(enc.encode(JSON.stringify({ ...payload, exp: expiresAt })));
  const mac = await crypto.subtle.sign('HMAC', key, enc.encode(body));
  return `${body}.${bytesToBase64Url(mac)}`;
}

/** The payload, or null for anything tampered, expired, too long or not ours. */
export async function readSigned(
  key: CryptoKey,
  token: string | null | undefined,
  now: number,
): Promise<Record<string, unknown> | null> {
  if (!token || token.length > SIGNED_PAYLOAD_MAX) return null;
  const [body, macText, extra] = token.split('.');
  if (!body || !macText || extra !== undefined) return null;
  const mac = base64ToBytes(macText);
  if (!mac) return null;
  const good = await crypto.subtle.verify('HMAC', key, new Uint8Array(mac), enc.encode(body));
  if (!good) return null;
  try {
    const bytes = base64ToBytes(body);
    const value: unknown = JSON.parse(dec.decode(bytes ?? new Uint8Array(0)));
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    const exp = (value as { exp?: unknown }).exp;
    if (typeof exp !== 'number' || exp <= now) return null;
    return value as Record<string, unknown>;
  } catch {
    return null;
  }
}
