// A plain endpoint's signature (liveworkspace/docs/specs/004-index/webhooks.md "Destinations"): HMAC-SHA256 under the
// webhook's own secret over `<timestamp>.<body>`, as `v1=<hex>`. Binding the timestamp in lets a receiver refuse an
// old delivery replayed, since the timestamp can't be changed without breaking the signature.

import { randomBase64Url } from '@liveworkspace/api-kit/bytes';

const enc = new TextEncoder();

/** A new signing secret: `whsec_` and 32 random bytes, base64url. */
export const newSigningSecret = () => `whsec_${randomBase64Url(32)}`;

export async function signatureOf(
  secret: string,
  timestamp: number,
  body: string,
): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const mac = await crypto.subtle.sign('HMAC', key, enc.encode(`${timestamp}.${body}`));
  return `v1=${[...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, '0')).join('')}`;
}
