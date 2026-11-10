// The numbers behind All apps' Apps Compared (liveworkspace/docs/specs/008-telemetry/telemetry.md "Apps Compared"):
// each app's events, visitors and sign-ups in the window, the span before it, the ratios read from them, and the
// daily series the charts draw. Pure, so the section only renders, and every figure is tested here.

import {
  emptyAudienceCounts,
  PLATFORM_TELEMETRY_APP,
  TELEMETRY_APPS,
  TELEMETRY_AUDIENCE_KEYS,
  type TelemetryApp,
  type TelemetryAudienceCounts,
  type TelemetryAudienceKey,
  type TelemetrySender,
  type TelemetrySummary,
  type TelemetryWindowKey,
} from '@liveworkspace/telemetry';
import { windowDays } from '../_shared/windows';

// Which apps the audience numbers are for: every app added up, or one.
export const TOTAL = 'total';
export type AudienceScope = TelemetryApp | typeof TOTAL;

// One window's audience numbers, with the sums the ratios need.
export type AudienceNumbers = TelemetryAudienceCounts & {
  // Returning guests and signed-in people together.
  returning: number;
  // New and returning: each is one browser's first open of the app that UTC day, so a day's visits are the browsers
  // that opened it that day. Over several days they are browser-days, never distinct people.
  visits: number;
};

export function audienceNumbers(counts: TelemetryAudienceCounts | undefined): AudienceNumbers {
  const c = counts ?? emptyAudienceCounts();
  const returning = c.returningGuests + c.returningSignedIn;
  return { ...c, returning, visits: c.newVisitors + returning };
}

function addCounts(into: TelemetryAudienceCounts, from: TelemetryAudienceCounts | undefined): void {
  if (!from) return;
  for (const k of TELEMETRY_AUDIENCE_KEYS) into[k] += from[k];
}

// `part / whole`, or null when there is no whole to be a share of (shown as a dash, never 0% or NaN).
export const ratio = (part: number, whole: number): number | null =>
  whole > 0 ? part / whole : null;

// One row of the comparison: an app, the platform's own events, or the total.
export type ComparedRow = {
  key: TelemetrySender | typeof TOTAL;
  events: number;
  eventsBefore: number;
  // Of every event in the window.
  share: number | null;
  now: AudienceNumbers;
  before: AudienceNumbers;
  // Visits divided by the window's days: the browsers on a typical day. Today is a day still running.
  avgDailyVisitors: number;
  avgDailyVisitorsBefore: number;
  // Of the visits, the ones from browsers that had been before: how much of the traffic comes back.
  returningShare: number | null;
  // Of the returning visits, the signed-in ones.
  signedInShare: number | null;
  // Sign-ups for each new visitor, a rough conversion: a returning guest may sign up too, so it can pass 1.
  signUpsPerNewVisitor: number | null;
  // How much each visit does.
  eventsPerVisit: number | null;
};

function row(
  key: ComparedRow['key'],
  events: number,
  eventsBefore: number,
  total: number,
  now: TelemetryAudienceCounts | undefined,
  before: TelemetryAudienceCounts | undefined,
  days: number,
): ComparedRow {
  const n = audienceNumbers(now);
  const b = audienceNumbers(before);
  return {
    key,
    events,
    eventsBefore,
    share: ratio(events, total),
    now: n,
    before: b,
    avgDailyVisitors: n.visits / days,
    avgDailyVisitorsBefore: b.visits / days,
    returningShare: ratio(n.returning, n.visits),
    signedInShare: ratio(n.returningSignedIn, n.returning),
    signUpsPerNewVisitor: ratio(n.signUps, n.newVisitors),
    eventsPerVisit: ratio(events, n.visits),
  };
}

export type Comparison = {
  // Every listed app, in TELEMETRY_APPS' order.
  apps: ComparedRow[];
  // liveworkspace.app's own events (the Explorer and Settings on All apps), when it has any in either span: it adds
  // to the total, so the table shows where the rest of the total came from. It has no visitors of its own.
  platform: ComparedRow | null;
  total: ComparedRow;
};

export function compareApps(
  summary: TelemetrySummary,
  active: TelemetryWindowKey,
  apps: readonly TelemetryApp[] = TELEMETRY_APPS,
): Comparison {
  const window = summary.windows[active];
  const previous = summary.previousWindows?.[active];
  const audience = summary.audience?.windows[active];
  const audienceBefore = summary.audience?.previousWindows[active];
  const days = windowDays(active);
  const total = window.total;

  const appRows = apps.map((app) =>
    row(
      app,
      window.byApp?.[app] ?? 0,
      previous?.byApp?.[app] ?? 0,
      total,
      audience?.[app],
      audienceBefore?.[app],
      days,
    ),
  );
  const platformNow = window.byApp?.[PLATFORM_TELEMETRY_APP] ?? 0;
  const platformBefore = previous?.byApp?.[PLATFORM_TELEMETRY_APP] ?? 0;
  const platform =
    platformNow > 0 || platformBefore > 0
      ? row(PLATFORM_TELEMETRY_APP, platformNow, platformBefore, total, undefined, undefined, days)
      : null;

  const sumNow = emptyAudienceCounts();
  const sumBefore = emptyAudienceCounts();
  for (const app of apps) {
    addCounts(sumNow, audience?.[app]);
    addCounts(sumBefore, audienceBefore?.[app]);
  }
  return {
    apps: appRows,
    platform,
    total: row(TOTAL, total, previous?.total ?? 0, total, sumNow, sumBefore, days),
  };
}

// The daily series of one audience number, for an app or every app added up: zeros when the summary has none.
export function audienceSeries(
  summary: TelemetrySummary,
  scope: AudienceScope,
  key: TelemetryAudienceKey,
  apps: readonly TelemetryApp[] = TELEMETRY_APPS,
): number[] {
  const length = summary.daily?.days.length ?? 0;
  const out = Array.from({ length }, () => 0);
  const daily = summary.audience?.daily;
  if (!daily) return out;
  for (const app of scope === TOTAL ? apps : [scope]) {
    const series = daily[app]?.[key];
    if (!series) continue;
    for (let i = 0; i < length; i++) out[i] = (out[i] ?? 0) + (series[i] ?? 0);
  }
  return out;
}

// Two series added day by day (returning guests and signed-in returns are one line on the chart).
export const addSeries = (a: number[], b: number[]): number[] => a.map((v, i) => v + (b[i] ?? 0));

// The scope's numbers out of a comparison.
export function scopeRow(comparison: Comparison, scope: AudienceScope): ComparedRow {
  return scope === TOTAL
    ? comparison.total
    : (comparison.apps.find((r) => r.key === scope) ?? comparison.total);
}

// Whether any audience event at all has arrived in the 30 days: none means the apps' builds predate the events, or
// the Worker serving the page does, and the section says so rather than drawing flat lines.
export function hasAudience(summary: TelemetrySummary): boolean {
  const daily = summary.audience?.daily;
  if (!daily) return false;
  return Object.values(daily).some(
    (series) =>
      series !== undefined && TELEMETRY_AUDIENCE_KEYS.some((k) => series[k].some((v) => v > 0)),
  );
}

// "42%", or a dash for no share.
export function formatShare(value: number | null): string {
  return value === null ? '–' : `${Math.round(value * 100)}%`;
}

// A count with at most one decimal (an average), grouped the British way.
export function formatAverage(value: number): string {
  return value.toLocaleString('en-GB', { maximumFractionDigits: 1 });
}

// Sign-ups per new visitor as "3.2 per 100", or a dash.
export function formatPer100(value: number | null): string {
  return value === null
    ? '–'
    : `${(value * 100).toLocaleString('en-GB', { maximumFractionDigits: 1 })} per 100`;
}

// Events per visit, one decimal, or a dash.
export function formatPerVisit(value: number | null): string {
  return value === null ? '–' : value.toLocaleString('en-GB', { maximumFractionDigits: 1 });
}
