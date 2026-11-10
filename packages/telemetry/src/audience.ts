// The audience numbers (liveworkspace/docs/specs/008-telemetry/telemetry.md "Apps Compared"): new and returning
// visitors, sign-ups and sign-ins, kept per app rather than merged, so All apps can compare the apps on them. They are
// read from five events every app already sends, never from an identity: there is none to read.
//
//   Participant·Created               a browser new to the app (a fresh guest identity)    -> newVisitors
//   Participant·Returned·Anonymous    a known browser back on a later UTC day, as a guest  -> returningGuests
//   Participant·Returned·Authenticated  the same, signed in                                -> returningSignedIn
//   Session·SignedUp                  an account the app has never seen completing sign-in -> signUps
//   Session·SignedIn                  a known account completing sign-in                   -> signIns
//
// The summary folds them in the same pass as everything else (summary.ts), so they cost no query.

import type { TelemetrySender } from './apps';

export const TELEMETRY_AUDIENCE_KEYS = [
  'newVisitors',
  'returningGuests',
  'returningSignedIn',
  'signUps',
  'signIns',
] as const;

export type TelemetryAudienceKey = (typeof TELEMETRY_AUDIENCE_KEYS)[number];

export type TelemetryAudienceCounts = Record<TelemetryAudienceKey, number>;
export type TelemetryAudienceSeries = Record<TelemetryAudienceKey, number[]>;

// Window keys are passed in as strings so this module needs nothing from summary.ts (which imports it).
export type TelemetryAudience<W extends string = string> = {
  // Each app's 30-day series of each number, on the summary's `daily.days`.
  daily: Partial<Record<TelemetrySender, TelemetryAudienceSeries>>;
  // Each window's numbers per app, and the same span just before it, for the trend arrows.
  windows: Record<W, Partial<Record<TelemetrySender, TelemetryAudienceCounts>>>;
  previousWindows: Record<W, Partial<Record<TelemetrySender, TelemetryAudienceCounts>>>;
};

// The events, by category, action and type ('' for none). A type the table doesn't name is not an audience event:
// Session·SignedIn carries none today, and a typed one later would be something else.
const AUDIENCE_EVENTS: ReadonlyMap<string, TelemetryAudienceKey> = new Map([
  ['Participant|Created|', 'newVisitors'],
  ['Participant|Returned|Anonymous', 'returningGuests'],
  ['Participant|Returned|Authenticated', 'returningSignedIn'],
  ['Session|SignedUp|', 'signUps'],
  ['Session|SignedIn|', 'signIns'],
]);

export function audienceKeyOf(
  category: string,
  action: string,
  type: string | null,
): TelemetryAudienceKey | undefined {
  return AUDIENCE_EVENTS.get(`${category}|${action}|${type ?? ''}`);
}

export function emptyAudienceCounts(): TelemetryAudienceCounts {
  return { newVisitors: 0, returningGuests: 0, returningSignedIn: 0, signUps: 0, signIns: 0 };
}

// Zeroes for every app counted, so an app that sent nothing still has its row, as `byApp` does.
export function emptyAudience<W extends string>(
  apps: readonly TelemetrySender[],
  windowKeys: readonly W[],
  seriesDays: number,
): TelemetryAudience<W> {
  const zeros = () => Array.from({ length: seriesDays }, () => 0);
  const perApp = () =>
    Object.fromEntries(apps.map((a) => [a, emptyAudienceCounts()])) as Partial<
      Record<TelemetrySender, TelemetryAudienceCounts>
    >;
  const perWindow = () =>
    Object.fromEntries(windowKeys.map((k) => [k, perApp()])) as TelemetryAudience<W>['windows'];
  return {
    daily: Object.fromEntries(
      apps.map((a) => [
        a,
        Object.fromEntries(
          TELEMETRY_AUDIENCE_KEYS.map((k) => [k, zeros()]),
        ) as TelemetryAudienceSeries,
      ]),
    ),
    windows: perWindow(),
    previousWindows: perWindow(),
  };
}

// Adds `n` to an app's count in one window's bucket. An app outside the summary's list (never, since the query is
// filtered the same way) gets its row on first sight rather than being dropped.
export function addAudienceCount(
  bucket: Partial<Record<TelemetrySender, TelemetryAudienceCounts>>,
  app: TelemetrySender,
  key: TelemetryAudienceKey,
  n: number,
): void {
  const counts = (bucket[app] ??= emptyAudienceCounts());
  counts[key] += n;
}

// Adds `n` to an app's series at day index `idx`.
export function addAudienceDay(
  audience: TelemetryAudience,
  app: TelemetrySender,
  key: TelemetryAudienceKey,
  idx: number,
  n: number,
  seriesDays: number,
): void {
  const series = (audience.daily[app] ??= Object.fromEntries(
    TELEMETRY_AUDIENCE_KEYS.map((k) => [k, Array.from({ length: seriesDays }, () => 0)]),
  ) as TelemetryAudienceSeries);
  series[key][idx] = (series[key][idx] ?? 0) + n;
}
