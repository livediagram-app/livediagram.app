import { describe, expect, it } from 'vitest';
import {
  buildTelemetrySummary,
  telemetryQueryStart,
  telemetrySeriesStart,
  type TelemetryDailyRow,
} from './summary';
import { TELEMETRY_APPS, type TelemetryApp } from './apps';

// The dashboard's windows must cover exactly the calendar days the trend line highlights: Today since
// UTC midnight, Last 7 days from midnight six days back, Last 30 days from midnight 29 days back.

const DAY = 24 * 60 * 60 * 1000;
// 2026-09-25 15:30 UTC, mid-afternoon so a rolling window would differ.
const NOW = Date.UTC(2026, 8, 25, 15, 30);
const MIDNIGHT = Date.UTC(2026, 8, 25);
const iso = (ts: number) => new Date(ts).toISOString().slice(0, 10);

// One event per day at `ts`, as the grouped per-day query returns it.
const at = (
  ts: number,
  type = 'Square',
  app: TelemetryApp = 'livediagram.app',
): TelemetryDailyRow => ({
  day: iso(ts),
  app,
  category: 'Element',
  action: 'Added',
  type,
  count: 1,
});

const build = (rows: TelemetryDailyRow[]) =>
  buildTelemetrySummary(NOW, 'all', TELEMETRY_APPS, rows);
const count = (s: ReturnType<typeof build>, key: 'today' | 'last7' | 'last30') =>
  s.windows[key].total;
const prev = (s: ReturnType<typeof build>, key: 'today' | 'last7' | 'last30') =>
  s.previousWindows![key].total;

describe('telemetry window boundaries', () => {
  it('starts the series at UTC midnight 29 days back', () => {
    expect(telemetrySeriesStart(NOW)).toBe(MIDNIGHT - 29 * DAY);
    expect(telemetrySeriesStart(MIDNIGHT)).toBe(MIDNIGHT - 29 * DAY);
    expect(telemetrySeriesStart(MIDNIGHT - 1)).toBe(MIDNIGHT - 30 * DAY);
  });

  it('counts today from UTC midnight, not the last 24 hours', () => {
    const s = build([at(MIDNIGHT), at(MIDNIGHT - 1)]);
    expect(count(s, 'today')).toBe(1);
    expect(count(s, 'last7')).toBe(2);
  });

  it('counts last 7 days as today plus the six whole days before it', () => {
    const firstDay = MIDNIGHT - 6 * DAY;
    const s = build([at(firstDay), at(firstDay - 1)]);
    expect(count(s, 'last7')).toBe(1);
    expect(count(s, 'last30')).toBe(2);
  });

  it('counts last month as exactly the 30 day series', () => {
    const firstDay = MIDNIGHT - 29 * DAY;
    const s = build([at(firstDay), at(firstDay - 1)]);
    expect(count(s, 'last30')).toBe(1);
    expect(s.daily!.days[0]).toBe(firstDay);
    expect(s.daily!.days).toHaveLength(30);
  });

  it('makes every window equal the sum of its highlighted trend span', () => {
    const rows = Array.from({ length: 30 }, (_, i) => ({
      ...at(MIDNIGHT - i * DAY, i % 2 ? 'Circle' : 'Square'),
      count: i + 1,
    }));
    const s = build(rows);
    const span = (n: number) => s.daily!.totals.slice(30 - n).reduce((a, b) => a + b, 0);
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
  it('reads the query one series further back than the series', () => {
    expect(telemetryQueryStart(NOW)).toBe(telemetrySeriesStart(NOW) - 30 * DAY);
  });

  it('counts the day before for today, and the 7 days before for the last 7', () => {
    const s = build([
      at(MIDNIGHT),
      at(MIDNIGHT - DAY),
      at(MIDNIGHT - 7 * DAY),
      at(MIDNIGHT - 13 * DAY),
      at(MIDNIGHT - 14 * DAY),
    ]);
    expect(prev(s, 'today')).toBe(1);
    expect(prev(s, 'last7')).toBe(2);
    expect(count(s, 'last7')).toBe(2);
  });

  it('counts the 30 days before the last 30 from the rows before the series', () => {
    const seriesStart = telemetrySeriesStart(NOW);
    const s = build([
      at(seriesStart),
      at(seriesStart - DAY),
      at(seriesStart - 30 * DAY),
      at(seriesStart - 31 * DAY),
    ]);
    expect(count(s, 'last30')).toBe(1);
    expect(prev(s, 'last30')).toBe(2);
    // Rows before the series never leak into the daily series.
    expect(s.daily!.totals.reduce((a, b) => a + b, 0)).toBe(1);
  });
});

describe('apps', () => {
  it('adds the same event from several apps into one row, and keeps each app’s share', () => {
    const s = build([
      { ...at(MIDNIGHT), count: 3 },
      { ...at(MIDNIGHT, 'Square', 'liveplanner.app'), count: 2 },
      at(MIDNIGHT - 8 * DAY, 'Square', 'liveplanner.app'),
    ]);
    expect(s.app).toBe('all');
    expect(s.windows.today.rows).toEqual([
      { category: 'Element', action: 'Added', type: 'Square', count: 5 },
    ]);
    expect(s.windows.today.byApp).toEqual({
      'livediagram.app': 3,
      'liveplanner.app': 2,
      'livedocuments.app': 0,
      'livedesign.app': 0,
    });
    expect(s.previousWindows!.last7.byApp).toEqual({
      'livediagram.app': 0,
      'liveplanner.app': 1,
      'livedocuments.app': 0,
      'livedesign.app': 0,
    });
    expect(s.daily!.byApp!['liveplanner.app']!.at(-1)).toBe(2);
    expect(s.daily!.byApp!['livediagram.app']!.at(-1)).toBe(3);
  });

  it('names only the app it was asked for', () => {
    const s = buildTelemetrySummary(
      NOW,
      'liveplanner.app',
      ['liveplanner.app'],
      [at(MIDNIGHT, 'Square', 'liveplanner.app')],
    );
    expect(s.app).toBe('liveplanner.app');
    expect(Object.keys(s.windows.today.byApp!)).toEqual(['liveplanner.app']);
  });
});

describe('summary cost', () => {
  it('folds a worst-case 59 days of rows quickly', () => {
    // 59 days × 2 apps × 1,500 distinct events: far more than either vocabulary holds.
    const rows: TelemetryDailyRow[] = [];
    const start = telemetryQueryStart(NOW);
    for (let d = 0; d < 59; d++)
      for (const app of TELEMETRY_APPS)
        for (let e = 0; e < 1500; e++)
          rows.push({ ...at(start + d * DAY, `T${e}`, app), count: e + 1 });
    const t = performance.now();
    const s = build(rows);
    const ms = performance.now() - t;
    expect(s.windows.last30.rows).toHaveLength(1500);
    expect(ms).toBeLessThan(1500);
  });
});
