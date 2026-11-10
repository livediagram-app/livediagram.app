import { describe, expect, it } from 'vitest';
import {
  buildTelemetrySummary,
  TELEMETRY_SENDERS,
  type TelemetryApp,
  type TelemetryDailyRow,
  type TelemetrySummary,
} from '@liveworkspace/telemetry';
import {
  addSeries,
  audienceNumbers,
  audienceSeries,
  compareApps,
  formatAverage,
  formatPer100,
  formatPerVisit,
  formatShare,
  hasAudience,
  ratio,
  scopeRow,
  TOTAL,
} from './apps-compared';

// Apps Compared's figures (liveworkspace/docs/specs/008-telemetry/telemetry.md "Apps Compared"), read from a summary
// the service would build: each app's events and audience in the window and the span before, and the ratios.

const DAY = 86_400_000;
const NOW = Date.UTC(2026, 10, 10, 15);
const MIDNIGHT = Date.UTC(2026, 10, 10);
const iso = (ts: number) => new Date(ts).toISOString().slice(0, 10);

const row = (
  ts: number,
  app: TelemetryDailyRow['app'],
  category: string,
  action: string,
  type: string | null,
  count: number,
): TelemetryDailyRow => ({ day: iso(ts), app, category, action, type, count });

const seen = (ts: number, app: TelemetryApp, fresh: number, guests: number, signedIn: number) => [
  row(ts, app, 'Participant', 'Created', null, fresh),
  row(ts, app, 'Participant', 'Returned', 'Anonymous', guests),
  row(ts, app, 'Participant', 'Returned', 'Authenticated', signedIn),
];

const summary = buildTelemetrySummary(NOW, 'all', TELEMETRY_SENDERS, [
  // Today: livediagram 10 new, 20 + 10 returning, 2 sign-ups, 5 sign-ins, 100 other events.
  ...seen(MIDNIGHT, 'livediagram.app', 10, 20, 10),
  row(MIDNIGHT, 'livediagram.app', 'Session', 'SignedUp', null, 2),
  row(MIDNIGHT, 'livediagram.app', 'Session', 'SignedIn', null, 5),
  row(MIDNIGHT, 'livediagram.app', 'Element', 'Added', 'Square', 100),
  // Today: liveplanner 5 new, nobody returning.
  ...seen(MIDNIGHT, 'liveplanner.app', 5, 0, 0),
  // Yesterday (the span before today): livediagram 4 new, 6 returning guests, 1 sign-up.
  ...seen(MIDNIGHT - DAY, 'livediagram.app', 4, 6, 0),
  row(MIDNIGHT - DAY, 'livediagram.app', 'Session', 'SignedUp', null, 1),
  // The platform's own events.
  row(MIDNIGHT, 'liveworkspace.app', 'Explorer', 'Opened', null, 7),
]);

// The summary as a Worker from before the audience numbers answers it.
function withoutAudience(): TelemetrySummary {
  const old: TelemetrySummary = { ...summary };
  delete old.audience;
  return old;
}

describe('audienceNumbers', () => {
  it('adds the returning kinds and the visits', () => {
    expect(
      audienceNumbers({
        newVisitors: 1,
        returningGuests: 2,
        returningSignedIn: 3,
        signUps: 0,
        signIns: 0,
      }),
    ).toMatchObject({ returning: 5, visits: 6 });
    expect(audienceNumbers(undefined)).toMatchObject({ returning: 0, visits: 0, signUps: 0 });
  });
});

describe('compareApps', () => {
  const today = compareApps(summary, 'today');
  const diagram = today.apps.find((r) => r.key === 'livediagram.app')!;
  const planner = today.apps.find((r) => r.key === 'liveplanner.app')!;

  it('lists every app in order, and the total', () => {
    expect(today.apps.map((r) => r.key)).toEqual([
      'livediagram.app',
      'liveplanner.app',
      'livedocuments.app',
      'livedesign.app',
      'livehuddle.app',
    ]);
    expect(today.total.key).toBe(TOTAL);
  });

  it("reads each app's events, share and the span before", () => {
    // 40 visitor events, 7 session events and 100 others.
    expect(diagram.events).toBe(147);
    expect(diagram.eventsBefore).toBe(11);
    expect(today.total.events).toBe(147 + 5 + 7);
    expect(diagram.share).toBeCloseTo(147 / 159);
  });

  it('works out the ratios', () => {
    expect(diagram.now.visits).toBe(40);
    expect(diagram.avgDailyVisitors).toBe(40);
    expect(diagram.returningShare).toBeCloseTo(30 / 40);
    expect(diagram.signedInShare).toBeCloseTo(10 / 30);
    expect(diagram.signUpsPerNewVisitor).toBeCloseTo(2 / 10);
    expect(diagram.eventsPerVisit).toBeCloseTo(147 / 40);
    expect(diagram.avgDailyVisitorsBefore).toBe(10);
    // No returning visits: no signed-in share rather than 0% or NaN.
    expect(planner.signedInShare).toBeNull();
    expect(planner.returningShare).toBe(0);
  });

  it('adds the apps up for the total', () => {
    expect(today.total.now).toMatchObject({ newVisitors: 15, returning: 30, signUps: 2 });
    expect(today.total.before).toMatchObject({ newVisitors: 4, returning: 6, signUps: 1 });
  });

  it("keeps the platform's own events apart, with no visitors", () => {
    expect(today.platform).toMatchObject({ key: 'liveworkspace.app', events: 7 });
    expect(today.platform!.now.visits).toBe(0);
    const none = buildTelemetrySummary(
      NOW,
      'all',
      TELEMETRY_SENDERS,
      seen(MIDNIGHT, 'livediagram.app', 1, 0, 0),
    );
    expect(compareApps(none, 'today').platform).toBeNull();
  });

  it('averages a longer window over its days', () => {
    const week = compareApps(summary, 'last7').apps[0]!;
    expect(week.now.visits).toBe(50);
    expect(week.avgDailyVisitors).toBeCloseTo(50 / 7);
  });

  it('reads a summary without audience numbers as zeros', () => {
    const old = withoutAudience();
    const r = compareApps(old, 'today').apps[0]!;
    expect(r.now.visits).toBe(0);
    expect(r.eventsPerVisit).toBeNull();
    expect(hasAudience(old)).toBe(false);
  });
});

describe('audienceSeries', () => {
  it('reads one app, or adds every app up', () => {
    expect(audienceSeries(summary, 'livediagram.app', 'newVisitors').slice(-2)).toEqual([4, 10]);
    expect(audienceSeries(summary, TOTAL, 'newVisitors').slice(-2)).toEqual([4, 15]);
    expect(audienceSeries(summary, TOTAL, 'newVisitors')).toHaveLength(30);
  });

  it('is zeros without audience numbers', () => {
    const old = withoutAudience();
    expect(audienceSeries(old, TOTAL, 'signUps').every((v) => v === 0)).toBe(true);
  });

  it('adds two series day by day', () => {
    expect(addSeries([1, 2], [3, 4])).toEqual([4, 6]);
  });
});

describe('scopeRow', () => {
  it("is the total, or the app's row", () => {
    const c = compareApps(summary, 'today');
    expect(scopeRow(c, TOTAL)).toBe(c.total);
    expect(scopeRow(c, 'liveplanner.app').key).toBe('liveplanner.app');
  });
});

describe('hasAudience', () => {
  it('is true once any audience event has arrived', () => {
    expect(hasAudience(summary)).toBe(true);
    const quiet = buildTelemetrySummary(NOW, 'all', TELEMETRY_SENDERS, [
      row(MIDNIGHT, 'livediagram.app', 'Element', 'Added', null, 3),
    ]);
    expect(hasAudience(quiet)).toBe(false);
  });
});

describe('the formats', () => {
  it('shows a dash where there is nothing to divide by', () => {
    expect(ratio(1, 0)).toBeNull();
    expect(formatShare(null)).toBe('–');
    expect(formatPer100(null)).toBe('–');
    expect(formatPerVisit(null)).toBe('–');
  });

  it('rounds shares, averages and rates', () => {
    expect(formatShare(0.756)).toBe('76%');
    expect(formatAverage(1234.56)).toBe('1,234.6');
    expect(formatPer100(0.0325)).toBe('3.3 per 100');
    expect(formatPerVisit(3.675)).toBe('3.7');
  });
});
