// livediagram's telemetry: @liveworkspace/telemetry-client bound to this product
// (docs/specs/017-telemetry/telemetry.md). The engine, the opt-out rule, page-hide, the error cap and
// the timing watch are shared; what is livediagram's own is here: its app on the central service,
// the key its preferences are stored under, its vocabulary's types, and its error and timing tokens
// from @livediagram/api-schema. Import those from here and everything else from
// @liveworkspace/telemetry-client.

import {
  errorNameToken,
  errorPageToken,
  errorTypeToken,
  pageViewPath,
  timingType,
  type TelemetryAction,
  type TelemetryCategory,
} from '@livediagram/api-schema';
import type { TelemetryApp } from '@liveworkspace/telemetry';
import {
  createClientErrorTracking,
  createSiteTrack,
  createTelemetryEmitter as createEmitter,
  createTiming,
  readTelemetryOptIn as readOptInUnder,
  type ErrorTrack,
  type TelemetryEmitter as Emitter,
} from '@liveworkspace/telemetry-client';

// This product's name on the central service.
export const TELEMETRY_APP: TelemetryApp = 'livediagram.app';

// Where the editor keeps its per-user preferences (docs/specs/007-editor/user-preferences.md). The
// help centre shares the livediagram.app origin, so an opt-out made in the editor has to be visible there,
// which means both apps read this exact string, and a copy in each is a silent privacy bug waiting to
// happen: version the key in the editor (`:v2`, an ordinary schema migration) and the help centre goes
// on reading the dead `:v1`, finds nothing, and falls back to its default of ON for a person who
// explicitly opted out. NEVER change it in place: people's saved preferences and their telemetry
// opt-out live under it.
export const USER_PREFERENCES_STORAGE_KEY = 'livediagram:user-preferences:v1';

export type TelemetryEmitter = Emitter<TelemetryCategory, TelemetryAction>;

/** An emitter typed by this product's vocabulary. */
export const createTelemetryEmitter = createEmitter<TelemetryCategory, TelemetryAction>;

/** The uncached opt-out read, under this product's key. */
export function readTelemetryOptIn(): boolean {
  return readOptInUnder(USER_PREFERENCES_STORAGE_KEY);
}

/**
 * The public sites' one track() (help centre, marketing, the dashboard): the shared policy with this
 * product's app and key. A module singleton, so a page that emits from several places runs one
 * buffer, not several.
 */
export const siteTrack: TelemetryEmitter['track'] = createSiteTrack<
  TelemetryCategory,
  TelemetryAction
>({ app: TELEMETRY_APP, storageKey: USER_PREFERENCES_STORAGE_KEY });

/** Window-level uncaught errors and rejections, named with this product's pages. Installs once. */
export const installClientErrorTracking: (track: ErrorTrack) => void = createClientErrorTracking({
  pageViewPath,
  errorPageToken,
  errorTypeToken,
  errorNameToken,
});

/** Timings bucketed on this product's metrics and scales. */
export const { reportTiming, startTiming } = createTiming(timingType);
