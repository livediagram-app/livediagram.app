import type { TelemetryCount, TelemetryDaily } from '@livediagram/api-schema';
import { describe, expect, it } from 'vitest';
import { pageViewRows, per100, risingPages, viewsOf } from './page-insights';

// The Pages tab's arithmetic (spec/150): only page views count, split by the
// app that serves each path, and ratios are views over views.

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

describe('viewsOf and per100', () => {
  it('sums page views only', () => {
    expect(viewsOf(ROWS, () => true)).toBe(212);
  });

  it('expresses one set of pages per 100 views of another', () => {
    expect(
      per100(
        ROWS,
        (p) => p === '/',
        (p) => p === '/new',
      ),
    ).toBe(25);
    expect(
      per100(
        ROWS,
        (p) => p.startsWith('/explorer'),
        (p) => p === '/diagram',
      ),
    ).toBe(180);
  });

  it('has no ratio when the base had no views', () => {
    expect(
      per100(
        ROWS,
        (p) => p === '/faq',
        (p) => p === '/new',
      ),
    ).toBeNull();
  });
});

describe('risingPages', () => {
  // 14 days: the first 7 are "prev", the last 7 are "last".
  const series = (prev: number, last: number) => [
    ...new Array(7).fill(prev / 7),
    ...new Array(7).fill(last / 7),
  ];
  const daily = {
    days: new Array(14).fill(0),
    totals: new Array(14).fill(0),
    byCategory: {},
    byMetric: {
      'Page|View|/': series(70, 140),
      'Page|View|/faq': series(7, 70),
      'Page|View|/help': series(70, 35),
      'Page|View|/new': series(14, 14),
      // Not a page view, however much it rose.
      'Help|View|the-canvas': series(0, 700),
    },
  } as TelemetryDaily;

  it('ranks pages by their gain, week on week, and skips flat or falling ones', () => {
    expect(risingPages(daily)).toEqual([
      { path: '/', last7: 140, prev7: 70 },
      { path: '/faq', last7: 70, prev7: 7 },
    ]);
  });

  it('caps the list', () => {
    expect(risingPages(daily, 1)).toHaveLength(1);
  });
});
