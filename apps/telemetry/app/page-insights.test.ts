import type { TelemetryCount, TelemetryDaily } from '@livediagram/api-schema';
import { describe, expect, it } from 'vitest';
import {
  event,
  pageView,
  pageViewRows,
  pickedSeries,
  readInsight,
  type InsightDef,
} from './page-insights';

// The Pages tab's arithmetic (spec/150): only page views count, split by the
// app that serves each path, and insights are one count over another.

const row = (category: string, action: string, type: string | null, count: number) =>
  ({ category, action, type, count }) as TelemetryCount;

const ROWS = [
  row('Page', 'View', '/', 40),
  row('Page', 'View', '/new', 10),
  row('Page', 'View', '/diagram', 90),
  row('Page', 'View', '/help/canvas/the-canvas', 12),
  row('Page', 'View', '/explorer', 20),
  row('Page', 'View', '/explorer/timeline', 30),
  row('Page', 'View', '/telemetry', 3),
  row('Page', 'View', '/alternatives/miro', 7),
  // Not page views, so never counted, whatever the type looks like.
  row('Help', 'View', 'the-canvas', 500),
  row('Diagram', 'Loaded', null, 200),
];

const paths = (rows: TelemetryCount[]) => rows.map((r) => r.type);

describe('pageViewRows', () => {
  it('ranks every page view, most viewed first, and nothing else', () => {
    expect(paths(pageViewRows(ROWS, 'All'))).toEqual([
      '/diagram',
      '/',
      '/explorer/timeline',
      '/explorer',
      '/help/canvas/the-canvas',
      '/new',
      '/alternatives/miro',
      '/telemetry',
    ]);
  });

  it('narrows to the app that serves each path', () => {
    expect(paths(pageViewRows(ROWS, 'Live'))).toEqual([
      '/diagram',
      '/explorer/timeline',
      '/explorer',
      '/new',
    ]);
    expect(paths(pageViewRows(ROWS, 'Marketing'))).toEqual(['/', '/alternatives/miro']);
    expect(paths(pageViewRows(ROWS, 'Help'))).toEqual(['/help/canvas/the-canvas']);
    expect(paths(pageViewRows(ROWS, 'Dashboard'))).toEqual(['/telemetry']);
  });
});

const def = (over: Partial<InsightDef> = {}): InsightDef => ({
  id: 'test',
  title: 'Test',
  detail: '',
  from: pageView((p) => p === '/'),
  to: pageView((p) => p === '/new'),
  fromLabel: '/',
  toLabel: '/new',
  scale: 100,
  unit: 'per 100',
  rising: 'good',
  ...over,
});

// Fourteen days of series, oldest first: the last 7 are "this week".
const DAYS = Array.from({ length: 14 }, (_, i) => i * 86_400_000);
const DAILY = {
  days: DAYS,
  byMetric: {
    'Page|View|/': [10, 10, 10, 10, 10, 10, 10, 20, 20, 20, 20, 20, 20, 20],
    'Page|View|/new': [1, 1, 1, 1, 1, 1, 1, 10, 10, 10, 10, 10, 10, 10],
    'Diagram|Created|Cloud': [0, 0, 0, 0, 0, 0, 0, 3, 3, 3, 3, 3, 3, 3],
    'Diagram|Created|Offline': [0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1],
  },
} as unknown as TelemetryDaily;

describe('readInsight', () => {
  it('falls back to the window rows without the 30-day series, as a rate per 100', () => {
    const reading = readInsight(def(), ROWS, undefined, 7);
    expect(reading).toMatchObject({ value: 25, to: 10, from: 40, previous: null, trend: [] });
  });

  it('counts the window from the series when it has them', () => {
    // This week: 70 /new over 140 landing views.
    expect(readInsight(def(), [], DAILY, 7)).toMatchObject({ value: 50, to: 70, from: 140 });
  });

  it('counts only from the day page views began, on both sides', () => {
    // Page views start on day 12; diagrams were being created all week.
    const late = {
      days: DAYS,
      byMetric: {
        'Page|View|/new': [...new Array(12).fill(0), 4, 4],
        'Diagram|Created|Cloud': new Array(14).fill(2),
      },
    } as unknown as TelemetryDaily;
    const wizard = def({ from: pageView((p) => p === '/new'), to: event('Diagram', 'Created') });
    const reading = readInsight(wizard, [], late, 7);
    expect(reading).toMatchObject({ to: 4, from: 8, value: 50, previous: null, since: DAYS[12] });
    expect(reading.trend.slice(0, 12).every((v) => v === null)).toBe(true);
  });

  it('only counts page views on a page-view side, whatever the type', () => {
    // `Help·View·the-canvas` is not a page view, so it never lands in "every page".
    const all = readInsight(def({ to: pageView(() => true) }), ROWS, undefined, 7);
    expect(all.to).toBe(212);
  });

  it('can put an event over the page views that lead to it, across every type', () => {
    const wizard = def({ from: pageView((p) => p === '/new'), to: event('Diagram', 'Created') });
    const rows = [
      row('Page', 'View', '/new', 8),
      row('Diagram', 'Created', 'Cloud', 3),
      row('Diagram', 'Created', 'Offline', 1),
    ];
    expect(readInsight(wizard, rows, undefined, 7).value).toBe(50);
  });

  it('has no rate when the base had nothing', () => {
    expect(
      readInsight(def({ from: pageView((p) => p === '/faq') }), ROWS, undefined, 7).value,
    ).toBeNull();
  });

  it('compares against the same span just before the window', () => {
    // The week before: 7 /new over 70 landing views = 10 per 100.
    expect(readInsight(def(), ROWS, DAILY, 7).previous).toBe(10);
  });

  it('has no previous span when the series cannot reach behind the window', () => {
    expect(readInsight(def(), ROWS, DAILY, 14).previous).toBeNull();
  });

  it('trends a trailing 7-day rate per day, gapped while the base is zero', () => {
    const { trend } = readInsight(def(), ROWS, DAILY, 7);
    expect(trend).toHaveLength(14);
    expect(trend[6]).toBe(10); // days 0..6: 7 over 70
    expect(trend[13]).toBe(50); // days 7..13: 70 over 140
    const empty = readInsight(def({ from: pageView((p) => p === '/faq') }), ROWS, DAILY, 7);
    expect(empty.trend.every((v) => v === null)).toBe(true);
  });

  it('sums every series a pick matches', () => {
    expect(pickedSeries(DAILY, event('Diagram', 'Created')).slice(-1)).toEqual([4]);
  });
});
