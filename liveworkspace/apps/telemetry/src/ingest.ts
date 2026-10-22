// POST /telemetry/api/events: every app's anonymous events (liveworkspace/docs/telemetry.md "Sending
// events"). A batch names its app; only that app's closed vocabulary is stored, with a server-stamped
// time. Always 204, because telemetry must never surface an error to the page or Worker that sent it.

import {
  isTelemetryApp,
  telemetryAppOfOrigin,
  TELEMETRY_BATCH_MAX,
  TELEMETRY_KEY_HEADER,
  type TelemetryApp,
} from '@liveworkspace/telemetry';
import { insertEvents } from './db';
import { appKey, type Env } from './env';
import { timingSafeEqual } from './timing-safe';
import { VOCABULARIES } from './vocabularies';

// A batch is at most 100 three-field events: anything far larger is not one of ours.
const MAX_BODY_BYTES = 64 * 1024;

const noop = () => new Response(null, { status: 204 });

export async function handleIngest(request: Request, env: Env): Promise<Response> {
  if (env.TELEMETRY_ENABLED !== 'true') return noop();
  if (Number(request.headers.get('Content-Length') ?? 0) > MAX_BODY_BYTES) return noop();
  let body: unknown;
  try {
    const text = await request.text();
    if (text.length > MAX_BODY_BYTES) return noop();
    body = JSON.parse(text);
  } catch {
    return noop();
  }
  const { app, events } = (body ?? {}) as { app?: unknown; events?: unknown };
  if (!isTelemetryApp(app) || !Array.isArray(events)) return noop();

  const sender = await senderOf(request, env, app);
  if (sender === null) return noop();
  // Browsers share one public door, so each network gets a budget. An app's own Workers hold its key
  // and are bounded by their own traffic, so they skip it.
  if (sender === 'browser' && env.EVENTS_RATE_LIMITER) {
    const { success } = await env.EVENTS_RATE_LIMITER.limit({ key: rateKey(request) });
    if (!success) return noop();
  }

  const vocabulary = VOCABULARIES[app];
  const valid = events
    .filter(vocabulary.isValid)
    // What only the app's Workers count, a browser can't add to: a stale bundle would count it twice.
    .filter((e) => sender === 'server' || !vocabulary.isServerOnly(e))
    .slice(0, TELEMETRY_BATCH_MAX);
  try {
    await insertEvents(env, app, valid, Date.now());
  } catch {
    // A transient D1 failure loses the batch; telemetry is fire-and-forget either way.
  }
  return noop();
}

// Who sent the batch, or null when it can't speak for `app`:
//   - 'server': it carries that app's own Worker key (Workers send no Origin);
//   - 'browser': its Origin is one of that app's pages, or a localhost page in development.
// Spoofable by curl, like any Origin check, which is what the rate limit and the closed vocabulary
// are for: the worst a forger can do is add plausible counts at a bounded rate.
async function senderOf(
  request: Request,
  env: Env,
  app: TelemetryApp,
): Promise<'server' | 'browser' | null> {
  const key = request.headers.get(TELEMETRY_KEY_HEADER);
  if (key !== null) {
    const expected = appKey(env, app);
    return expected && (await timingSafeEqual(key, expected)) ? 'server' : null;
  }
  const origin = request.headers.get('Origin');
  if (origin === null) return null;
  if (telemetryAppOfOrigin(origin) === app) return 'browser';
  return env.ENVIRONMENT === 'development' && isLocalhost(origin) ? 'browser' : null;
}

function isLocalhost(origin: string): boolean {
  try {
    const { hostname } = new URL(origin);
    return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]';
  } catch {
    return false;
  }
}

// The rate-limit key: the exact IPv4 address (one is often a whole office behind NAT), or the IPv6
// /64 (a single host is routinely handed a whole /64). Never stored.
export function rateKey(request: Request): string {
  const ip = request.headers.get('CF-Connecting-IP') ?? 'anonymous';
  if (!ip.includes(':')) return ip;
  const [head = '', tail = ''] = ip.split('::');
  const left = head ? head.split(':') : [];
  const right = tail ? tail.split(':') : [];
  const full = ip.includes('::')
    ? [...left, ...Array.from({ length: 8 - left.length - right.length }, () => '0'), ...right]
    : left;
  return `${full
    .slice(0, 4)
    .map((h) => h.toLowerCase().replace(/^0+(?=.)/, ''))
    .join(':')}::/64`;
}
