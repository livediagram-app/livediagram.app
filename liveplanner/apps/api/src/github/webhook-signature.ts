// A delivery's signature (docs/specs/026-plan/github-pull-requests.md "Deliveries"; blueprint "Part 2"):
// `X-Hub-Signature-256: sha256=<hex>`, the HMAC-SHA256 of the raw body under the webhook secret. Checked on the bytes
// as they came, before anything parses them, and compared in constant time.
import { timingSafeEqual } from '@liveworkspace/index-app/timing-safe';

export const SIGNATURE_HEADER = 'X-Hub-Signature-256';
const PREFIX = 'sha256=';
const HEX_DIGITS = 64;

const enc = new TextEncoder();

function isLowerHex(text: string): boolean {
  for (let i = 0; i < text.length; i += 1) {
    const c = text.charCodeAt(i);
    if (!((c >= 48 && c <= 57) || (c >= 97 && c <= 102))) return false;
  }
  return true;
}

/** The HMAC-SHA256 of `body` under `secret`, as lower-case hex. */
export async function hmacHex(secret: string, body: Uint8Array): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const mac = new Uint8Array(await crypto.subtle.sign('HMAC', key, body));
  return Array.from(mac, (b) => b.toString(16).padStart(2, '0')).join('');
}

/** Whether `header` is the body's signature under `secret`. A missing or malformed header is false. */
export async function webhookSignatureOk(
  secret: string,
  body: Uint8Array,
  header: string | null,
): Promise<boolean> {
  if (!header?.startsWith(PREFIX)) return false;
  const sent = header.slice(PREFIX.length).trim().toLowerCase();
  if (sent.length !== HEX_DIGITS || !isLowerHex(sent)) return false;
  return timingSafeEqual(await hmacHex(secret, body), sent);
}
