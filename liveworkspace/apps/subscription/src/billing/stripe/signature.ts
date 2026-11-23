// A Stripe webhook's signature (subscription.md "Stripe"): `Stripe-Signature: t=<seconds>,v1=<hex>[,v1=<hex>]`, each
// v1 an HMAC-SHA256 of `<t>.<raw body>` with the endpoint's signing secret. Checked with WebCrypto, in constant time,
// and only within a few minutes of `t`, so an old event can't be sent again.

import { timingSafeEqual } from '@liveworkspace/index-app/timing-safe';
import { STRIPE_SIGNATURE_TOLERANCE_S } from '../../config';

const encoder = new TextEncoder();

function hexOf(bytes: ArrayBuffer): string {
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function signatureOf(
  secret: string,
  timestamp: number,
  payload: string,
): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  return hexOf(await crypto.subtle.sign('HMAC', key, encoder.encode(`${timestamp}.${payload}`)));
}

/** Whether `header` signs `payload` with `secret`, at most the tolerance from `now` (ms). */
export async function isSignedByStripe(
  secret: string,
  header: string | null,
  payload: string,
  now: number,
): Promise<boolean> {
  if (!header || header.length > 2048) return false;
  let timestamp: number | null = null;
  const signatures: string[] = [];
  for (const part of header.split(',')) {
    const [key, value] = part.split('=', 2).map((side) => side?.trim() ?? '');
    if (key === 't' && /^\d{1,12}$/.test(value ?? '')) timestamp = Number(value);
    else if (key === 'v1' && /^[0-9a-f]{64}$/.test(value ?? '')) signatures.push(value!);
  }
  if (timestamp === null || signatures.length === 0) return false;
  if (Math.abs(now / 1000 - timestamp) > STRIPE_SIGNATURE_TOLERANCE_S) return false;
  const expected = await signatureOf(secret, timestamp, payload);
  const matches = await Promise.all(
    signatures.map((signature) => timingSafeEqual(signature, expected)),
  );
  return matches.includes(true);
}
