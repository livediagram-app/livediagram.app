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

// The one help centre's All Apps view (liveworkspace/docs/specs/016-help/blueprints/help-centre.md "Telemetry"), at
// www.liveworkspace.app/help: the events each app's help sends in its own name, here in liveworkspace.app's, so the
// batch's app is the scope. `View`, `Helpful` and `Unhelpful` carry the article's telemetry id, a bounded token;
// `Searched` the outcome ('Results' | 'NoResults'), never the query; `Changed` the app switch's move
// ('Scope.<scope>').
export const PLATFORM_HELP_TELEMETRY_ACTIONS = [
  'View',
  'Searched',
  'Helpful',
  'Unhelpful',
  'Changed',
] as const;

const HELP_SEARCH_TYPES: readonly string[] = ['Results', 'NoResults'];
const HELP_SCOPE_TYPE = /^Scope\.(all|livediagram|liveplanner|livedocuments|livedesign|livehuddle)$/;
const HELP_ARTICLE_TYPE = /^[a-z0-9-]{1,40}$/;

/** Whether the All Apps help could have sent this event: a Help action with its own kind of token. */
export function isPlatformHelpTelemetryEvent(event: TelemetryWireEvent): boolean {
  if (event.category !== 'Help') return false;
  const type = event.type ?? null;
  switch (event.action) {
    case 'Searched':
      return type !== null && HELP_SEARCH_TYPES.includes(type);
    case 'Changed':
      return type !== null && HELP_SCOPE_TYPE.test(type);
    case 'View':
    case 'Helpful':
    case 'Unhelpful':
      return type !== null && HELP_ARTICLE_TYPE.test(type);
    default:
      return false;
  }
}

/** Whether liveworkspace.app could have sent this event in its own name: a known pair with one of its tokens, or one
 *  of the All Apps help's events. */
export function isPlatformOwnTelemetryEvent(event: TelemetryWireEvent): boolean {
  if (isPlatformHelpTelemetryEvent(event)) return true;
  const types = TYPES[`${event.category}·${event.action}`];
  return types !== undefined && types.includes(event.type ?? null);
}
