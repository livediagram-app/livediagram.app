// The api Worker's own telemetry (docs/specs/017-telemetry/telemetry.md), sent to liveworkspace's central service
// (liveworkspace/docs/telemetry.md) as liveplanner.app. The send itself, its gate and its key are the shared
// `postServerEvents` (@liveworkspace/telemetry); this file only fixes the app and its event vocabulary.

import type { TelemetryAction, TelemetryCategory } from '@liveplanner/api-schema';
import {
  postServerEvents,
  serverTelemetryEnabled,
  type TelemetryWireEvent,
} from '@liveworkspace/telemetry';
import type { Env } from './types';

export const telemetryEnabled = (env: Env): boolean => serverTelemetryEnabled(env);

export const reportServerEvents = (
  env: Env,
  events: readonly TelemetryWireEvent[],
): Promise<void> => postServerEvents(env, 'liveplanner.app', events);

export function reportServerEvent(
  env: Env,
  category: TelemetryCategory,
  action: TelemetryAction,
  type: string | null = null,
): Promise<void> {
  return reportServerEvents(env, [{ category, action, type }]);
}
