// Server telemetry in tests: reportServerEvents posts each batch to the liveworkspace telemetry
// service (src/server-telemetry.ts), so a test reads what was counted off a stubbed global fetch.
// Each capture lasts one test, and the real fetch is back once the test finishes.

import {
  TELEMETRY_EVENTS_PATH,
  TELEMETRY_URL,
  type TelemetryBatch,
  type TelemetryWireEvent,
} from '@liveworkspace/telemetry';
import { onTestFinished, vi } from 'vitest';

// The env vars that switch server telemetry on: the flag, and a key to post with.
export const TELEMETRY_ON = { TELEMETRY_ENABLED: 'true', TELEMETRY_KEY: 'k' } as const;

// Every event posted to the service during this test, in order.
export function captureTelemetry(): TelemetryWireEvent[] {
  const events: TelemetryWireEvent[] = [];
  vi.stubGlobal('fetch', (input: Request | string | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    if (url === `${TELEMETRY_URL}${TELEMETRY_EVENTS_PATH}` && typeof init?.body === 'string') {
      events.push(...(JSON.parse(init.body) as TelemetryBatch).events);
    }
    return Promise.resolve(new Response(null, { status: 204 }));
  });
  onTestFinished(() => void vi.unstubAllGlobals());
  return events;
}
