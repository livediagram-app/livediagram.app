// /api/events — the relay for clients that can't reach the liveworkspace telemetry service
// themselves (docs/specs/017-telemetry/telemetry.md "The relay").

import { isServerEmittedEvent, isValidTelemetryEvent } from '@livedocuments/api-schema';
import { TELEMETRY_BATCH_MAX } from '@liveworkspace/telemetry';
import { isLocalhostPair } from '../origin-check';
import { noContent, notFound } from '../responses';
import { clientRateKey } from '@liveworkspace/api-kit/client-ip';
import { reportServerEvents } from '../server-telemetry';
import type { RouteContext } from './context';

// Telemetry is stored by the liveworkspace service (liveworkspace/docs/telemetry.md), which takes a
// batch only from one of livedocuments.app's pages or from a Worker holding livedocuments' key. The CLI
// is neither: it runs on somebody's machine and posts to its profile's api, so the api passes its
// anonymous counts on under its own key. Batched POST of { events }; no auth, no stored identity;
// only the closed vocabulary goes on. Off unless TELEMETRY_ENABLED. Always 204 — telemetry must
// never surface an error to the caller.

export async function handleEvents(ctx: RouteContext): Promise<Response> {
  const { request, env, url, segments } = ctx;
  if (!(segments[1] === 'events' && segments.length === 2)) return notFound();
  if (request.method !== 'POST') return notFound();
  const noop = noContent();
  if (env.TELEMETRY_ENABLED !== 'true') return noop;
  // Abuse controls (docs/specs/017-telemetry/telemetry.md). The endpoint is anonymous +
  // unauthenticated, so guard it WITHOUT identifying users:
  //   (1) Same-origin only — drop a request whose Origin header is
  //       present and isn't this site. Stops casual cross-origin /
  //       drive-by posting; spoofable by curl, which (2) then
  //       catches.
  //   (2) Per-IP rate limit keyed on CF-Connecting-IP (which the
  //       client can't forge, unlike X-Owner-Id). A SEPARATE
  //       limiter from the document write limiter, so it never
  //       touches real users; the IP is a transient key, never
  //       stored or passed on. Both degrade to "allow" when unconfigured, so
  //       self-host / OSS forks still work. Cloudflare's edge DDoS
  //       + an optional WAF rate-limit rule on /api/events sit in
  //       front of all this (see docs/specs/017-telemetry/telemetry.md). Always 204 — telemetry
  //       must never surface an error.
  const origin = request.headers.get('Origin');
  if (origin && origin !== url.origin && !isLocalhostPair(origin, url.origin)) return noop;
  if (env.EVENTS_RATE_LIMITER) {
    const { success } = await env.EVENTS_RATE_LIMITER.limit({ key: clientRateKey(request) });
    if (!success) return noop;
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return noop;
  }
  // `?.`: a JSON `null` (or any non-object) body is still a no-op, never a 500.
  const raw = (body as { events?: unknown } | null)?.events;
  if (!Array.isArray(raw)) return noop;
  // Validate against the shared schema and cap the batch so one
  // request can't bulk-insert. Unknown categories/actions/types
  // are dropped, never stored.
  // Pairs the worker counts itself (Session·SignedUp / SignedIn,
  // Document·Joined, Email·Sent) are dropped here too, so a stale editor
  // bundle that still emits them can't double count (docs/specs/017-telemetry/telemetry.md).
  const valid = raw
    .filter(isValidTelemetryEvent)
    .filter((e) => !isServerEmittedEvent(e))
    .slice(0, TELEMETRY_BATCH_MAX)
    .map((e) => ({ category: e.category, action: e.action, type: e.type ?? null }));
  // Swallows its own failure: the batch is lost either way, the 204 is not.
  await reportServerEvents(env, valid);
  return noop;
}
