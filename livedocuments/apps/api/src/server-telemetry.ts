// The api worker's own telemetry (docs/specs/017-telemetry/telemetry.md), sent to liveworkspace's central
// service (liveworkspace/docs/telemetry.md) as livedocuments.app.
//
// A few events can only be counted honestly by the api worker, because the
// browser either never sees them (an email sent from a cron) or cannot tell
// whether they are the first of their kind (a new account, a first visit to a
// shared document), and a crash counts even when no client survives to report it.
//
// A Worker sends no Origin, so each post carries livedocuments' Worker key
// (TELEMETRY_KEY); without the key, or with TELEMETRY_ENABLED off, nothing is
// sent. Its own failure is swallowed: telemetry must never turn a successful
// request into a thrown one.

import type { TelemetryAction, TelemetryCategory } from '@livedocuments/api-schema';
import {
  TELEMETRY_EVENTS_PATH,
  TELEMETRY_KEY_HEADER,
  TELEMETRY_URL,
  type TelemetryBatch,
} from '@liveworkspace/telemetry';
import type { Env } from './types';

export function telemetryEnabled(env: Env): boolean {
  return env.TELEMETRY_ENABLED === 'true' && !!env.TELEMETRY_KEY;
}

export async function reportServerEvent(
  env: Env,
  category: TelemetryCategory,
  action: TelemetryAction,
  type: string | null = null,
): Promise<void> {
  await reportServerEvents(env, [{ category, action, type }]);
}

// Several events in one post.
export async function reportServerEvents(
  env: Env,
  events: { category: TelemetryCategory; action: TelemetryAction; type: string | null }[],
): Promise<void> {
  if (!telemetryEnabled(env) || events.length === 0) return;
  const batch: TelemetryBatch = { app: 'livedocuments.app', events };
  await fetch(`${env.TELEMETRY_URL || TELEMETRY_URL}${TELEMETRY_EVENTS_PATH}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', [TELEMETRY_KEY_HEADER]: env.TELEMETRY_KEY! },
    body: JSON.stringify(batch),
  })
    .then((res) => res.body?.cancel())
    .catch(() => {});
}
