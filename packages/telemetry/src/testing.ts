// Tests' view of the central telemetry service: stubs the global fetch, keeps the events of every batch posted to
// its events path and answers 204. Pair with TELEMETRY_ON in the env. Each capture lasts one test, and the real
// fetch is back once the test finishes.
import { onTestFinished, vi } from 'vitest';
import { TELEMETRY_EVENTS_PATH, type TelemetryBatch, type TelemetryWireEvent } from './wire';

// The env vars that switch server telemetry on: the flag, and a key to post with.
export const TELEMETRY_ON = { TELEMETRY_ENABLED: 'true', TELEMETRY_KEY: 'k' } as const;

// Every event posted to the service during this test, in order.
export function captureTelemetry(): TelemetryWireEvent[] {
  const events: TelemetryWireEvent[] = [];
  vi.stubGlobal('fetch', (input: Request | string | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    if (url.endsWith(TELEMETRY_EVENTS_PATH) && typeof init?.body === 'string') {
      events.push(...(JSON.parse(init.body) as TelemetryBatch).events);
    }
    return Promise.resolve(new Response(null, { status: 204 }));
  });
  onTestFinished(() => void vi.unstubAllGlobals());
  return events;
}
