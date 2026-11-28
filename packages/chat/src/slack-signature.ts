// Slack's request check (liveworkspace/docs/specs/023-chat-apps/chat-apps.md "Slack's request check"): the `v0`
// signature, an HMAC-SHA256 of `v0:<timestamp>:<raw body>` under the app's signing secret, compared in constant
// time, and a timestamp more than five minutes from now refused, so a captured request can't be sent again later.
import { timingSafeEqual } from '@liveworkspace/index-app/timing-safe';
import { CHAT_REQUEST_WINDOW_S } from './limits';

export type SlackCheck = 'ok' | 'missing' | 'stale' | 'bad';

const enc = new TextEncoder();

const hex = (bytes: ArrayBuffer) =>
  [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, '0')).join('');

/** The signature Slack sends for this body at this time: `v0=<hex>`. */
export async function slackSignature(secret: string, timestamp: string, body: string) {
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const mac = await crypto.subtle.sign('HMAC', key, enc.encode(`v0:${timestamp}:${body}`));
  return `v0=${hex(mac)}`;
}

/** Whether a request is Slack's: the headers' `X-Slack-Request-Timestamp` and `X-Slack-Signature` and the raw body,
 *  read before anything in it is believed. `now` in milliseconds. */
export async function verifySlackRequest(check: {
  secret: string;
  timestamp: string | null;
  signature: string | null;
  body: string;
  now: number;
}): Promise<SlackCheck> {
  const { secret, timestamp, signature, body, now } = check;
  if (!secret || !timestamp || !signature) return 'missing';
  if (!/^\d{1,12}$/.test(timestamp)) return 'bad';
  if (Math.abs(now / 1000 - Number(timestamp)) > CHAT_REQUEST_WINDOW_S) return 'stale';
  const expected = await slackSignature(secret, timestamp, body);
  return (await timingSafeEqual(expected, signature)) ? 'ok' : 'bad';
}
