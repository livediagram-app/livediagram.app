// Version history's server-side telemetry (docs/specs/006-document/version-history.md "Observability and telemetry"):
// a restore and a copy, typed by the front door, once the write landed. One literal emit each, so the dashboard's
// emitter scan sees both.
import type { FrontDoor } from '../changesets/front-door';
import { reportServerEvent } from '../server-telemetry';
import type { Env } from '../types';

export function versionTelemetry(
  env: Env,
  action: 'Restored' | 'Copied',
  frontDoor: FrontDoor,
): Promise<void> {
  return action === 'Restored'
    ? reportServerEvent(env, 'Version', 'Restored', frontDoor)
    : reportServerEvent(env, 'Version', 'Copied', frontDoor);
}
