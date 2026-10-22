import { describe, expect, it } from 'vitest';
import { metricKey, type TelemetrySummary } from '@liveplanner/api-schema';
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

  it("retires the wizard's Location step and the Quick Start, not their successors", () => {
    for (const type of [
      'SkipLocationStepOn',
      'SkipLocationStepOff',
      'TemplateShelfExpanded',
      'TemplateShelfCollapsed',
      'TemplateModeAll',
      'TemplateModeDiagram',
      'TemplateModeDraw',
      'TemplateModeWorkshop',
      'TemplateModePages',
      'TemplateModePlan',
    ])
      expect(isRetiredEvent('UI', 'Toggled', type)).toBe(true);
    expect(isRetiredEvent('UI', 'Used', 'StartOtherMode')).toBe(false);
    expect(isRetiredEvent('UI', 'Closed', 'NewDocument')).toBe(false);
    expect(isRetiredEvent('Template', 'Used', 'Kanban')).toBe(false);
  });

  it('retires Settings › Experimental and its mode switches, not the modes', () => {
    expect(isRetiredEvent('UI', 'Opened', 'SettingsExperimental')).toBe(true);
    expect(isRetiredEvent('UI', 'Toggled', 'PagesModeOn')).toBe(true);
    expect(isRetiredEvent('UI', 'Toggled', 'PagesModeOff')).toBe(true);
    expect(isRetiredEvent('UI', 'Toggled', 'PlanModeOn')).toBe(true);
    expect(isRetiredEvent('UI', 'Toggled', 'PlanModeOff')).toBe(true);
    expect(isRetiredEvent('Editor', 'Changed', 'ModePlan')).toBe(false);
    expect(isRetiredEvent('UI', 'Opened', 'SettingsAi')).toBe(false);
  });

  it('retires Pages mode, not the presentations, slides and backgrounds that outlive it', () => {
    expect(isRetiredEvent('Tab', 'Changed', 'PageAdded')).toBe(true);
    expect(isRetiredEvent('Tab', 'Changed', 'PageKindLogo')).toBe(true);
    expect(isRetiredEvent('Tab', 'Changed', 'WireframeDeviceIphone')).toBe(true);
    expect(isRetiredEvent('Element', 'Added', 'ArticleTable')).toBe(true);
    expect(isRetiredEvent('Element', 'Changed', 'ShapesUnited')).toBe(true);
    expect(isRetiredEvent('Document', 'Exported', 'PagesPDFPages')).toBe(true);
    expect(isRetiredEvent('Document', 'Exported', 'LogoKit')).toBe(true);
    expect(isRetiredEvent('UI', 'View', 'PagesTourStepSlideWelcome')).toBe(true);
    expect(isRetiredEvent('UI', 'Started', 'LogoTour')).toBe(true);
    expect(isRetiredEvent('UI', 'Toggled', 'LogoGuideGridOn')).toBe(true);
    expect(isRetiredEvent('UI', 'Toggled', 'SlidesTourSeenOff')).toBe(true);
    expect(isRetiredEvent('UI', 'Changed', 'ContentsPlacementButton')).toBe(true);
    expect(isRetiredEvent('UI', 'Added', 'PageSlide')).toBe(true);
    expect(isRetiredEvent('Mcp', 'Used', 'WriteArticle')).toBe(true);
    expect(isRetiredEvent('Cli', 'Used', 'PageSet')).toBe(true);
    expect(isRetiredEvent('UI', 'Added', 'Slide')).toBe(false);
    expect(isRetiredEvent('UI', 'Added', 'BoardSlide')).toBe(false);
    expect(isRetiredEvent('Tab', 'Changed', 'PageBackgroundAnimated')).toBe(false);
    expect(isRetiredEvent('UI', 'Used', 'TabWindowOpen')).toBe(false);
    expect(isRetiredEvent('UI', 'Started', 'PlanTour')).toBe(false);
    expect(isRetiredEvent('Document', 'Exported', 'PNG')).toBe(false);
    expect(isRetiredEvent('Help', 'View', 'pages')).toBe(false);
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

// docs/specs/017-telemetry/telemetry.md: a deployment with telemetry off answers `{ enabled: false }` alone, and the
// dashboard shows that it is off. Dropping retired events from it threw, which read as a failed request.
describe('dropRetiredEvents on a deployment with telemetry off', () => {
  it('hands the summary back as it came', () => {
    const off = { enabled: false } as unknown as TelemetrySummary;
    expect(() => dropRetiredEvents(off)).not.toThrow();
    expect(dropRetiredEvents(off)).toBe(off);
  });
});
