// What an app's api Worker sends the central ingest itself (liveworkspace/docs/telemetry.md "Sending events").
//
// A few events can only be counted honestly by a Worker, because the browser either never sees them (an email
// sent from a cron) or cannot tell whether they are the first of their kind (a new account, a first visit to a
// shared item). The Worker posts those itself, proving with its TELEMETRY_KEY that the batch is its app's own.
//
// Gated on TELEMETRY_ENABLED like every other emit, and a no-op without the key. Its own failure is swallowed:
// telemetry must never turn a successful request into a thrown one.

import type { TelemetrySender } from './apps';
import {
  TELEMETRY_EVENTS_PATH,
  TELEMETRY_KEY_HEADER,
  TELEMETRY_URL,
  type TelemetryBatch,
  type TelemetryWireEvent,
} from './wire';

// The slice of a Worker's env the send reads.
export type ServerTelemetryEnv = {
  TELEMETRY_ENABLED?: string;
  TELEMETRY_URL?: string;
  TELEMETRY_KEY?: string;
};

export function serverTelemetryEnabled(env: ServerTelemetryEnv): boolean {
  return env.TELEMETRY_ENABLED === 'true';
}

export async function postServerEvents(
  env: ServerTelemetryEnv,
  app: TelemetrySender,
  events: readonly TelemetryWireEvent[],
): Promise<void> {
  const key = env.TELEMETRY_KEY;
  if (!serverTelemetryEnabled(env) || !key || events.length === 0) return;
  const batch: TelemetryBatch = { app, events: [...events] };
  try {
    await fetch(`${env.TELEMETRY_URL || TELEMETRY_URL}${TELEMETRY_EVENTS_PATH}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', [TELEMETRY_KEY_HEADER]: key },
      body: JSON.stringify(batch),
    });
  } catch {
    // Fire-and-forget: the event is lost, the request is not.
  }
}
