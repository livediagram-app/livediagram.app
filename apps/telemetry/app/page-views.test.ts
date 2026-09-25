import type { TelemetryCount } from '@livediagram/api-schema';
import { describe, expect, it } from 'vitest';
import { pageViewRows } from './page-views';

// The Pages tab's arithmetic (spec/150): only page views count, split by the
// app that serves each path.

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
