import { describe, expect, it } from 'vitest';
import type { TelemetrySummary } from '@liveworkspace/telemetry';
import { kitFigures } from './project-kits';

// Project Kits' figures from a summary that predates them: no daily series, no span before, other events beside.
const window = (rows: TelemetrySummary['windows']['today']['rows']) => ({ total: 0, rows });

describe("Project Kits' figures", () => {
  it('reads the window alone, ignoring other events and steps it does not know', () => {
    const summary: TelemetrySummary = {
      enabled: true,
      generatedAt: 0,
      windows: {
        today: window([
          { category: 'Kit', action: 'Started', type: 'SoftwareProject', count: 2 },
          { category: 'Kit', action: 'Opened', type: 'SoftwareProject', count: 9 },
          { category: 'Document', action: 'Started', type: null, count: 5 },
        ]),
        last7: window([]),
        last30: window([]),
      },
    };
    const figures = kitFigures(summary, 'today');
    expect(figures.steps.Started).toEqual({ now: 2, before: 0 });
    expect(figures.steps.Completed).toEqual({ now: 0, before: 0 });
    expect(figures.completedShare).toBe(0);
    expect(figures.daily.Started).toEqual([]);
    expect(figures.counted).toBe(false);
  });

  it('adds every kit up a day, and the span before', () => {
    const summary: TelemetrySummary = {
      enabled: true,
      generatedAt: 0,
      windows: { today: window([]), last7: window([]), last30: window([]) },
      previousWindows: {
        today: window([{ category: 'Kit', action: 'Removed', type: 'WebsiteBuild', count: 4 }]),
        last7: window([]),
        last30: window([]),
      },
      daily: {
        days: [1, 2],
        totals: [0, 0],
        byCategory: {},
        byMetric: {
          'Kit|Retried|SoftwareProject': [1, 0],
          'Kit|Retried|TeamWorkshop': [2, 3],
        },
      },
    };
    const figures = kitFigures(summary, 'today');
    expect(figures.daily.Retried).toEqual([3, 3]);
    expect(figures.daily.Removed).toEqual([0, 0]);
    expect(figures.steps.Removed).toEqual({ now: 0, before: 4 });
    expect(figures.completedShare).toBeNull();
    expect(figures.counted).toBe(true);
  });
});
