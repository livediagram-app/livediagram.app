// POST /api/telemetry/events: every app's anonymous events (liveworkspace/docs/specs/008-telemetry/telemetry.md "Sending
// events"). A batch names its app; only that app's closed vocabulary is stored, with a server-stamped
// time. Always 204, because telemetry must never surface an error to the page or Worker that sent it.

import {
  isExplorerTelemetryEvent,
  isPlatformOrigin,
  isTelemetryApp,
  isTelemetrySender,
  PLATFORM_TELEMETRY_APP,
  telemetryAppOfOrigin,
  TELEMETRY_BATCH_MAX,
  TELEMETRY_KEY_HEADER,
  type TelemetrySender,
} from '@liveworkspace/telemetry';
import { clientRateKey } from '@liveworkspace/api-kit/client-ip';
import { insertEvents } from './db';
import { appKey, type Env } from './env';
import { timingSafeEqual } from '@liveworkspace/index-app/timing-safe';
import { isLocalhostOrigin } from '@liveworkspace/index-app/worker-http';
import { isSiteSettingsEvent, VOCABULARIES } from './vocabularies';

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
  if (!isTelemetrySender(app) || !Array.isArray(events)) return noop();

  const sender = await senderOf(request, env, app);
  if (sender === null) return noop();
  // Browsers share one public door, so each network gets a budget. An app's own Workers hold its key
  // and are bounded by their own traffic, so they skip it. The key is every api's (api-kit's clientRateKey): the exact
  // IPv4 address, or the IPv6 /64. Never stored.
  if (sender !== 'server' && env.EVENTS_RATE_LIMITER) {
    const { success } = await env.EVENTS_RATE_LIMITER.limit({ key: clientRateKey(request) });
    if (!success) return noop();
  }

  const vocabulary = VOCABULARIES[app];
  const valid = events
    .filter(vocabulary.isValid)
    // What only the app's Workers count, a browser can't add to: a stale bundle would count it twice.
    .filter((e) => sender === 'server' || !vocabulary.isServerOnly(e))
    // liveworkspace.app speaks for an app only through its Explorer and the app's settings changed there, so only
    // those events.
    .filter(
      (e) => sender !== 'platform' || isExplorerTelemetryEvent(e) || isSiteSettingsEvent(app, e),
    )
    .slice(0, TELEMETRY_BATCH_MAX);
  try {
    await insertEvents(env, app, valid, Date.now());
  } catch (err) {
    // A D1 failure loses the batch; telemetry is fire-and-forget either way, so the sender still hears 204.
    console.error('[telemetry] batch lost', err);
  }
  return noop();
}

// Who sent the batch, or null when it can't speak for `app`:
//   - 'server': it carries that app's own Worker key (Workers send no Origin);
//   - 'browser': its Origin is one of that app's pages, or a localhost page in development;
//   - 'platform': its Origin is liveworkspace.app, whose Explorer speaks for the app it is filtered to,
//     or for liveworkspace.app itself (All Apps), and for an app whose settings are changed there. Only the
//     Explorer's events and the app's settings events are taken from it.
// Spoofable by curl, like any Origin check, which is what the rate limit and the closed vocabulary
// are for: the worst a forger can do is add plausible counts at a bounded rate.
async function senderOf(
  request: Request,
  env: Env,
  app: TelemetrySender,
): Promise<'server' | 'browser' | 'platform' | null> {
  const key = request.headers.get(TELEMETRY_KEY_HEADER);
  if (key !== null) {
    if (!isTelemetryApp(app)) return null;
    const expected = appKey(env, app);
    return expected && (await timingSafeEqual(key, expected)) ? 'server' : null;
  }
  const origin = request.headers.get('Origin');
  if (origin === null) return null;
  if (isPlatformOrigin(origin)) return 'platform';
  if (isTelemetryApp(app) && telemetryAppOfOrigin(origin) === app) return 'browser';
  if (env.ENVIRONMENT !== 'development' || !isLocalhostOrigin(origin)) return null;
  // A localhost page in development: the site's Explorer (liveworkspace.app's own name) as the
  // platform, an app as itself.
  return app === PLATFORM_TELEMETRY_APP ? 'platform' : 'browser';
}
