// Tests' view of the central telemetry service (docs/specs/017-telemetry/telemetry.md): stubs the global
// fetch, keeps the events of every batch posted to its events path and answers 204. Pair with
// TELEMETRY_ON in the env, and restore with vi.unstubAllGlobals.
import { vi } from 'vitest';
import { TELEMETRY_EVENTS_PATH, type TelemetryBatch } from '@liveworkspace/telemetry';
import type { Env } from './types';

export const TELEMETRY_ON = { TELEMETRY_ENABLED: 'true', TELEMETRY_KEY: 'k' } as Partial<Env>;

export function stubTelemetry(): TelemetryBatch['events'] {
  const events: TelemetryBatch['events'] = [];
  vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = input instanceof Request ? input.url : String(input);
    if (url.endsWith(TELEMETRY_EVENTS_PATH) && typeof init?.body === 'string') {
      events.push(...(JSON.parse(init.body) as TelemetryBatch).events);
    }
    return new Response(null, { status: 204 });
  });
  return events;
}
