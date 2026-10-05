import { describe, expect, it } from 'vitest';
import { metricKey, type TelemetrySummary } from '@livediagram/api-schema';
import { dropRetiredEvents, isRetiredEvent } from './retired-events';

// docs/specs/017-telemetry/telemetry.md "Retired features": the removed Activity panel's events never
// reach a chart.

describe('isRetiredEvent', () => {
  it('retires the Activity panel events', () => {
    expect(isRetiredEvent('Document', 'Reverted', null)).toBe(true);
    expect(isRetiredEvent('UI', 'Opened', 'Activity')).toBe(true);
    expect(isRetiredEvent('UI', 'Opened', 'SettingsActivity')).toBe(true);
    expect(isRetiredEvent('UI', 'Toggled', 'ActivityPanelOff')).toBe(true);
    expect(isRetiredEvent('UI', 'Toggled', 'ActivityRevertPreviewOn')).toBe(true);
    expect(isRetiredEvent('UI', 'Opened', 'reverting-changes')).toBe(true);
    expect(isRetiredEvent('Help', 'View', 'what-it-is')).toBe(true);
    expect(isRetiredEvent('Help', 'Helpful', 'activity-panel')).toBe(true);
  });

  it('retires the palette Favourites events', () => {
    expect(isRetiredEvent('UI', 'Added', 'PaletteFavourite')).toBe(true);
    expect(isRetiredEvent('UI', 'Removed', 'PaletteFavourite')).toBe(true);
    expect(isRetiredEvent('UI', 'Changed', 'PaletteFavourite')).toBe(true);
    expect(isRetiredEvent('UI', 'Toggled', 'PaletteFavouritesEdit')).toBe(true);
    expect(isRetiredEvent('UI', 'Searched', 'PaletteSearch')).toBe(true);
    expect(isRetiredEvent('Help', 'View', 'favourites')).toBe(true);
    expect(isRetiredEvent('UI', 'Opened', 'favourites')).toBe(true);
    // The palette's other searches, and the Explorer's document favourites, carry on.
    expect(isRetiredEvent('UI', 'Searched', 'IconSearch')).toBe(false);
    expect(isRetiredEvent('Help', 'View', 'popular')).toBe(false);
  });

  it('keeps everything that still exists', () => {
    expect(isRetiredEvent('Document', 'Undone', null)).toBe(false);
    expect(isRetiredEvent('Help', 'View', 'undo')).toBe(false);
    expect(isRetiredEvent('UI', 'Opened', 'undo')).toBe(false);
    expect(isRetiredEvent('Activity', 'Opened', null)).toBe(false);
    expect(isRetiredEvent('UI', 'Opened', 'Settings')).toBe(false);
  });
});

describe('dropRetiredEvents', () => {
  const reverted = metricKey('Document', 'Reverted', null);
  const undone = metricKey('Document', 'Undone', null);
  const summary = {
    enabled: true,
    generatedAt: 0,
    windows: {
      today: {
        total: 5,
        rows: [
          { category: 'Document', action: 'Reverted', type: null, count: 2 },
          { category: 'Document', action: 'Undone', type: null, count: 3 },
        ],
      },
      last7: { total: 3, rows: [{ category: 'Document', action: 'Undone', type: null, count: 3 }] },
      last30: {
        total: 3,
        rows: [{ category: 'Document', action: 'Undone', type: null, count: 3 }],
      },
    },
    daily: {
      days: [1, 2],
      totals: [4, 6],
      byCategory: { Document: [4, 6] },
      byMetric: { [reverted]: [1, 2], [undone]: [3, 4] },
    },
  } as unknown as TelemetrySummary;

  it('takes retired rows out of the windows and their totals', () => {
    const out = dropRetiredEvents(summary);
    expect(out.windows.today.rows.map((r) => r.action)).toEqual(['Undone']);
    expect(out.windows.today.total).toBe(3);
    expect(out.windows.last7).toBe(summary.windows.last7);
  });

  it('takes retired series out of the daily lines', () => {
    const daily = dropRetiredEvents(summary).daily!;
    expect(Object.keys(daily.byMetric)).toEqual([undone]);
    expect(daily.byCategory.Document).toEqual([3, 4]);
    expect(daily.totals).toEqual([3, 4]);
  });
});
