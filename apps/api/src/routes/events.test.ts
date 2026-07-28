import { beforeEach, describe, expect, it, vi } from 'vitest';
import { makeTestRouteContext } from './test-route-context';

// Telemetry ingest (spec/22). Everything here answers 204 whatever happens —
// telemetry must never surface an error to the caller — so the assertions are
// about what reached the DB layer, not the status code.
//
// The rate-limit exemption (issue #36) is the reason most of these exist: our
// own workers reach this over a service binding, which carries no
// CF-Connecting-IP, so `clientIp` fell back to the literal 'anonymous' and
// every internal caller shared ONE 120/min bucket. The overflow was dropped
// as a 204 nobody could see.

const { db } = vi.hoisted(() => ({ db: { insertTelemetryEvents: vi.fn() } }));
vi.mock('../db', () => db);

import type { Env } from '../types';
import { handleEvents } from './events';

const EVENT = { category: 'Mcp', action: 'Used', type: 'ReadDiagram' };

const makeCtx = (opts: { env?: Partial<Env>; headers?: Record<string, string> } = {}) =>
  makeTestRouteContext('POST', '/api/events', {
    body: { events: [EVENT] },
    headers: opts.headers,
    env: { TELEMETRY_ENABLED: 'true', ...opts.env } as Env,
  });

const limiter = (success: boolean) => {
  const limit = vi.fn(() => Promise.resolve({ success }));
  return { binding: { limit }, limit };
};

beforeEach(() => db.insertTelemetryEvents.mockReset());

describe('handleEvents rate limiting', () => {
  it('drops a batch when the per-IP limiter refuses', async () => {
    const { binding, limit } = limiter(false);
    const res = await handleEvents(makeCtx({ env: { EVENTS_RATE_LIMITER: binding } }));
    expect(res.status).toBe(204);
    expect(limit).toHaveBeenCalledTimes(1);
    expect(db.insertTelemetryEvents).not.toHaveBeenCalled();
  });

  it('exempts a caller holding the internal key, so it cannot be throttled', async () => {
    const { binding, limit } = limiter(false);
    const res = await handleEvents(
      makeCtx({
        env: { EVENTS_RATE_LIMITER: binding, INTERNAL_EVENTS_KEY: 'shhh' },
        headers: { 'X-Internal-Events-Key': 'shhh' },
      }),
    );
    expect(res.status).toBe(204);
    // The limiter isn't merely overridden — it's never consulted.
    expect(limit).not.toHaveBeenCalled();
    expect(db.insertTelemetryEvents).toHaveBeenCalledTimes(1);
  });

  it('does not exempt a wrong key', async () => {
    const { binding, limit } = limiter(false);
    await handleEvents(
      makeCtx({
        env: { EVENTS_RATE_LIMITER: binding, INTERNAL_EVENTS_KEY: 'shhh' },
        headers: { 'X-Internal-Events-Key': 'guess' },
      }),
    );
    expect(limit).toHaveBeenCalledTimes(1);
    expect(db.insertTelemetryEvents).not.toHaveBeenCalled();
  });

  // Without the secret configured server-side, the header is just a header —
  // otherwise anyone could send it and opt themselves out of the limiter.
  it('does not exempt anyone when no key is configured', async () => {
    const { binding, limit } = limiter(false);
    await handleEvents(
      makeCtx({
        env: { EVENTS_RATE_LIMITER: binding },
        headers: { 'X-Internal-Events-Key': 'shhh' },
      }),
    );
    expect(limit).toHaveBeenCalledTimes(1);
    expect(db.insertTelemetryEvents).not.toHaveBeenCalled();
  });

  it('still ingests normally when the limiter allows', async () => {
    const { binding, limit } = limiter(true);
    await handleEvents(makeCtx({ env: { EVENTS_RATE_LIMITER: binding } }));
    expect(limit).toHaveBeenCalledTimes(1);
    expect(db.insertTelemetryEvents).toHaveBeenCalledTimes(1);
  });

  it('ingests nothing at all when telemetry is off', async () => {
    await handleEvents(makeCtx({ env: { TELEMETRY_ENABLED: 'false' } }));
    expect(db.insertTelemetryEvents).not.toHaveBeenCalled();
  });
});
