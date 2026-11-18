// liveworkspace.app's own events (liveworkspace/docs/specs/008-telemetry/telemetry.md "Its own events"): what the site
// reports in its own name and never in an app's, because it is every app's at once. Today the project kits
// (liveworkspace/docs/specs/004-index/kits.md "Telemetry"): a run started, retried, completed and removed, each with
// its kit's token.
//
// One list for the three that must agree: the site's emitter (it sends nothing else in these categories), the
// service's ingest (liveworkspace.app's vocabulary), and the All apps view's Project Kits chart.

import type { TelemetryWireEvent } from './wire';

// Each kit's token, the catalogue's ids (@liveworkspace/index-client KITS) in the dashboards' casing.
export const KIT_TELEMETRY_TYPES = [
  'SoftwareProject',
  'ProductLaunch',
  'TeamWorkshop',
  'WebsiteBuild',
] as const;
export type KitTelemetryType = (typeof KIT_TELEMETRY_TYPES)[number];

// A run's steps, in the order the chart lists them.
export const KIT_TELEMETRY_ACTIONS = ['Started', 'Retried', 'Completed', 'Removed'] as const;
export type KitTelemetryAction = (typeof KIT_TELEMETRY_ACTIONS)[number];

export const PLATFORM_OWN_TELEMETRY_EVENTS = {
  'Kit·Started': KIT_TELEMETRY_TYPES,
  'Kit·Retried': KIT_TELEMETRY_TYPES,
  'Kit·Completed': KIT_TELEMETRY_TYPES,
  'Kit·Removed': KIT_TELEMETRY_TYPES,
} as const satisfies Record<`Kit·${KitTelemetryAction}`, readonly (string | null)[]>;

const TYPES = PLATFORM_OWN_TELEMETRY_EVENTS as Record<string, readonly (string | null)[]>;

/** Whether liveworkspace.app could have sent this event in its own name: a known pair with one of its tokens. */
export function isPlatformOwnTelemetryEvent(event: TelemetryWireEvent): boolean {
  const types = TYPES[`${event.category}·${event.action}`];
  return types !== undefined && types.includes(event.type ?? null);
}
