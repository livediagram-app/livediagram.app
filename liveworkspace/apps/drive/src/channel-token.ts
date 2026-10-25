// The push channel's token (liveworkspace/docs/drive.md "Cadence"): Google echoes it on every notification as
// X-Goog-Channel-Token, and it names the person and proves the service made it, so /api/drive/push maps a
// notification to a mirror without a lookup table. `<person id>.<HMAC-SHA256 of it>`, signed with a key derived from
// DRIVE_TOKEN_KEY by HKDF (the sealing key itself never signs). Google caps a token at 256 characters.

import { base64ToBytes, bytesToBase64Url } from '@liveworkspace/drive';
import { driveKeyBytes } from '@liveworkspace/drive/server';

const enc = new TextEncoder();
const TOKEN_MAX = 256;

async function channelKey(secret: string, usage: 'sign' | 'verify'): Promise<CryptoKey | null> {
  const raw = driveKeyBytes(secret);
  if (!raw) return null;
  const base = await crypto.subtle.importKey('raw', raw, 'HKDF', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: new Uint8Array(0),
      info: enc.encode('liveworkspace drive channel'),
    },
    base,
    { name: 'HMAC', hash: 'SHA-256', length: 256 },
    false,
    [usage],
  );
}

export async function channelToken(secret: string, personId: string): Promise<string> {
  const key = await channelKey(secret, 'sign');
  if (!key) throw new Error('DRIVE_TOKEN_KEY is not a 32-byte base64 key');
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(personId));
  return `${personId}.${bytesToBase64Url(sig)}`;
}

/** The person a token names, or null for one the service didn't make. `crypto.subtle.verify` is constant-time. */
export async function channelPerson(secret: string, token: string | null): Promise<string | null> {
  if (!token || token.length > TOKEN_MAX) return null;
  const dot = token.lastIndexOf('.');
  if (dot <= 0) return null;
  const personId = token.slice(0, dot);
  const sig = base64ToBytes(token.slice(dot + 1));
  const key = await channelKey(secret, 'verify');
  if (!sig || !key) return null;
  const ok = await crypto.subtle.verify('HMAC', key, new Uint8Array(sig), enc.encode(personId));
  return ok ? personId : null;
}
