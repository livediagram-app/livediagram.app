// Server-side telemetry (docs/specs/017-telemetry/telemetry.md), sent to the liveworkspace telemetry
// service (liveworkspace/docs/telemetry.md), which stores every app's events in its own database.
//
// A few events can only be counted honestly by the api worker, because the
// browser either never sees them (an email sent from a cron) or cannot tell
// whether they are the first of their kind (a new account, a first visit to a
// shared document). The worker posts those itself, proving with its
// TELEMETRY_KEY that the batch is livediagram's own.
//
// Gated on TELEMETRY_ENABLED like every other emit, and a no-op without the
// key. Its own failure is swallowed: telemetry must never turn a successful
// request into a thrown one.

import type { TelemetryAction, TelemetryCategory } from '@livediagram/api-schema';
import {
  TELEMETRY_EVENTS_PATH,
  TELEMETRY_KEY_HEADER,
  TELEMETRY_URL,
  type TelemetryBatch,
  type TelemetryWireEvent,
} from '@liveworkspace/telemetry';
import type { Env } from './types';

export function telemetryEnabled(env: Env): boolean {
  return env.TELEMETRY_ENABLED === 'true';
}

export async function reportServerEvents(
  env: Env,
  events: readonly TelemetryWireEvent[],
): Promise<void> {
  const key = env.TELEMETRY_KEY;
  if (!telemetryEnabled(env) || !key || events.length === 0) return;
  const batch: TelemetryBatch = { app: 'livediagram.app', events: [...events] };
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

export function reportServerEvent(
  env: Env,
  category: TelemetryCategory,
  action: TelemetryAction,
  type: string | null = null,
): Promise<void> {
  return reportServerEvents(env, [{ category, action, type }]);
}
