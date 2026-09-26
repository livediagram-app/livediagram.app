// Server-side telemetry self-reports (docs/specs/017-telemetry/telemetry.md).
//
// A few events can only be counted honestly by the api worker, because the
// browser either never sees them (an email sent from a cron) or cannot tell
// whether they are the first of their kind (a new account, a first visit to a
// shared diagram). Those rows are written straight to the events table rather
// than through POST /api/events.
//
// Gated on TELEMETRY_ENABLED like every other emit, and its own failure is
// swallowed: telemetry must never turn a successful request into a thrown one.

import type { TelemetryAction, TelemetryCategory } from '@livediagram/api-schema';
import { insertTelemetryEvents } from './db/telemetry';
import type { Env } from './types';

export function telemetryEnabled(env: Env): boolean {
  return env.TELEMETRY_ENABLED === 'true';
}

export async function reportServerEvent(
  env: Env,
  category: TelemetryCategory,
  action: TelemetryAction,
  type: string | null = null,
): Promise<void> {
  if (!telemetryEnabled(env)) return;
  await insertTelemetryEvents(env, [{ category, action, type }], Date.now()).catch(() => {});
}
