// /api/events — anonymous telemetry ingest (spec/22).

import { isValidTelemetryEvent } from '@livediagram/api-schema';
import { insertTelemetryEvents } from '../db';
import { isLocalhostPair } from '../origin-check';
import { noContent, notFound } from '../responses';
import type { RouteContext } from './context';

// Anonymous telemetry ingest (spec/22). Batched POST of
// { events: TelemetryEvent[] }. No auth, no stored identity: only
// the closed-vocabulary three-field events (validated here) reach
// D1, with a server-stamped ts. Off unless TELEMETRY_ENABLED, so
// OSS forks ingest nothing by default. Always 204 — telemetry must
// never surface an error to the caller.
export async function handleEvents(ctx: RouteContext): Promise<Response> {
  const { request, env, url, segments } = ctx;
  if (!(segments[1] === 'events' && segments.length === 2)) return notFound();
  if (request.method !== 'POST') return notFound();
  const noop = noContent();
  if (env.TELEMETRY_ENABLED !== 'true') return noop;
  // Abuse controls (spec/22). The endpoint is anonymous +
  // unauthenticated, so guard it WITHOUT identifying users:
  //   (1) Same-origin only — drop a request whose Origin header is
  //       present and isn't this site. Stops casual cross-origin /
  //       drive-by posting; spoofable by curl, which (2) then
  //       catches.
  //   (2) Per-IP rate limit keyed on CF-Connecting-IP (which the
  //       client can't forge, unlike X-Owner-Id). A SEPARATE
  //       limiter from the diagram write limiter, so it never
  //       touches real users; the IP is a transient key, never
  //       stored. Both degrade to "allow" when unconfigured, so
  //       self-host / OSS forks still work. Cloudflare's edge DDoS
  //       + an optional WAF rate-limit rule on /api/events sit in
  //       front of all this (see spec/22). Always 204 — telemetry
  //       must never surface an error.
  const origin = request.headers.get('Origin');
  if (origin && origin !== url.origin && !isLocalhostPair(origin, url.origin)) return noop;
  if (env.EVENTS_RATE_LIMITER) {
    const ip = request.headers.get('CF-Connecting-IP') ?? 'anonymous';
    const { success } = await env.EVENTS_RATE_LIMITER.limit({ key: ip });
    if (!success) return noop;
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return noop;
  }
  const raw = (body as { events?: unknown }).events;
  if (!Array.isArray(raw)) return noop;
  // Validate against the shared schema and cap the batch so one
  // request can't bulk-insert. Unknown categories/actions/types
  // are dropped, never stored.
  const valid = raw.filter(isValidTelemetryEvent).slice(0, 100);
  await insertTelemetryEvents(
    env,
    valid.map((e) => ({ category: e.category, action: e.action, type: e.type ?? null })),
    Date.now(),
  );
  return noop;
}
