import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// The dashboard's windows (spec/22) must cover exactly the calendar days the
// trend line highlights: Today since UTC midnight, Last 7 days from midnight
// six days back, Last 30 days from midnight 29 days back. They used to be
// rolling (`now - 7d`, `now - 30d`), so each count included a partial extra
// day the highlighted span didn't show.

const { db } = vi.hoisted(() => ({ db: { telemetryDailyCountsSince: vi.fn() } }));
vi.mock('../db', () => db);

import {
  buildTelemetrySummary,
  handleTelemetry,
  telemetryQueryStart,
  telemetrySeriesStart,
} from './telemetry';
import type { RouteContext } from './context';
import type { Env } from '../types';

const DAY = 24 * 60 * 60 * 1000;
// 2026-09-25 15:30 UTC, mid-afternoon so a rolling window would differ.
const NOW = Date.UTC(2026, 8, 25, 15, 30);
const MIDNIGHT = Date.UTC(2026, 8, 25);
const iso = (ts: number) => new Date(ts).toISOString().slice(0, 10);

// One event per day at `ts`, as the grouped per-day query returns it.
const at = (ts: number, type = 'Square') => ({
  day: iso(ts),
  category: 'Element',
  action: 'Added',
  type,
  count: 1,
});

const count = (s: ReturnType<typeof buildTelemetrySummary>, key: 'today' | 'last7' | 'last30') =>
  s.windows[key].total;

describe('telemetry window boundaries', () => {
  it('starts the series at UTC midnight 29 days back', () => {
    expect(telemetrySeriesStart(NOW)).toBe(MIDNIGHT - 29 * DAY);
    expect(telemetrySeriesStart(MIDNIGHT)).toBe(MIDNIGHT - 29 * DAY);
    expect(telemetrySeriesStart(MIDNIGHT - 1)).toBe(MIDNIGHT - 30 * DAY);
  });

  it('counts today from UTC midnight, not the last 24 hours', () => {
    const s = buildTelemetrySummary(NOW, [at(MIDNIGHT), at(MIDNIGHT - 1)]);
    expect(count(s, 'today')).toBe(1);
    expect(count(s, 'last7')).toBe(2);
  });

  it('counts last 7 days as today plus the six whole days before it', () => {
    const firstDay = MIDNIGHT - 6 * DAY;
    // Inside a rolling `now - 7d` window, but a day before the highlighted span.
    const dayBefore = firstDay - 1;
    expect(dayBefore).toBeGreaterThan(NOW - 7 * DAY);
    const s = buildTelemetrySummary(NOW, [at(firstDay), at(dayBefore)]);
    expect(count(s, 'last7')).toBe(1);
    expect(count(s, 'last30')).toBe(2);
  });

  it('counts last month as exactly the 30 day series', () => {
    const firstDay = MIDNIGHT - 29 * DAY;
    // The query starts at the series start, but a stray older row is ignored.
    const s = buildTelemetrySummary(NOW, [at(firstDay), at(firstDay - 1)]);
    expect(count(s, 'last30')).toBe(1);
    expect(s.daily?.days[0]).toBe(firstDay);
    expect(s.daily?.days).toHaveLength(30);
  });

  it('makes every window equal the sum of its highlighted trend span', () => {
    const rows = Array.from({ length: 30 }, (_, i) => ({
      ...at(MIDNIGHT - i * DAY, i % 2 ? 'Circle' : 'Square'),
      count: i + 1,
    }));
    const s = buildTelemetrySummary(NOW, rows);
    const totals = s.daily!.totals;
    const span = (n: number) => totals.slice(30 - n).reduce((a, b) => a + b, 0);
    expect(count(s, 'today')).toBe(span(1));
    expect(count(s, 'last7')).toBe(span(7));
    expect(count(s, 'last30')).toBe(span(30));
    // Rows fold per event across days, most-used first.
    expect(s.windows.last30.rows.map((r) => r.type)).toEqual(['Circle', 'Square']);
    expect(s.windows.today.rows).toEqual([
      { category: 'Element', action: 'Added', type: 'Square', count: 1 },
    ]);
  });
});

describe('previous windows (trend arrows)', () => {
  const prev = (s: ReturnType<typeof buildTelemetrySummary>, key: 'today' | 'last7' | 'last30') =>
    s.previousWindows?.[key].total;

  it('reads the query one series further back than the series', () => {
    expect(telemetryQueryStart(NOW)).toBe(telemetrySeriesStart(NOW) - 30 * DAY);
  });

  it('counts the day before for today, and the 7 days before for the last 7', () => {
    const s = buildTelemetrySummary(NOW, [
      at(MIDNIGHT), // today
      at(MIDNIGHT - DAY), // yesterday: previous today, inside last 7
      at(MIDNIGHT - 7 * DAY), // the week before: previous last 7
      at(MIDNIGHT - 13 * DAY), // still the week before
      at(MIDNIGHT - 14 * DAY), // neither
    ]);
    expect(prev(s, 'today')).toBe(1);
    expect(prev(s, 'last7')).toBe(2);
    expect(count(s, 'last7')).toBe(2);
  });

  it('counts the 30 days before the last 30 from the rows before the series', () => {
    const seriesStart = telemetrySeriesStart(NOW);
    const s = buildTelemetrySummary(NOW, [
      at(seriesStart), // inside the last 30
      at(seriesStart - DAY), // the 30 before
      at(seriesStart - 30 * DAY), // the first day of the 30 before
      at(seriesStart - 31 * DAY), // too old to count
    ]);
    expect(count(s, 'last30')).toBe(1);
    expect(prev(s, 'last30')).toBe(2);
    // Rows before the series never leak into the daily series.
    expect(s.daily?.totals.reduce((a, b) => a + b, 0)).toBe(1);
  });
});

describe('handleTelemetry', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    db.telemetryDailyCountsSince.mockReset().mockResolvedValue([at(MIDNIGHT)]);
  });
  afterEach(() => vi.useRealTimers());

  // localhost skips the edge cache, so the handler runs without `caches`.
  const ctx = (env: Partial<Env>) => {
    const url = new URL('http://localhost/api/telemetry/summary');
    return {
      request: new Request(url),
      env: env as Env,
      url,
      segments: ['api', 'telemetry', 'summary'],
    } as unknown as RouteContext;
  };

  it('reads the per-day counts once, one series before the series start', async () => {
    const res = await handleTelemetry(ctx({ TELEMETRY_ENABLED: 'true' }));
    expect(db.telemetryDailyCountsSince).toHaveBeenCalledTimes(1);
    // 30 days of series plus the 30 before, for the last-30 trend arrow.
    expect(db.telemetryDailyCountsSince.mock.calls[0]![1]).toBe(MIDNIGHT - 59 * DAY);
    const body = (await res.json()) as ReturnType<typeof buildTelemetrySummary>;
    expect(body.windows.today.total).toBe(1);
  });

  it('answers disabled without touching D1', async () => {
    const res = await handleTelemetry(ctx({}));
    expect(await res.json()).toEqual({ enabled: false });
    expect(db.telemetryDailyCountsSince).not.toHaveBeenCalled();
  });
});
