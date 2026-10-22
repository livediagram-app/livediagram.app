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
    expect(isRetiredEvent('Template', 'Used', 'Kanban')).toBe(false);
  });

  it('retires the New Document wizard, not the template link', () => {
    expect(isRetiredEvent('UI', 'Closed', 'NewDocument')).toBe(true);
    expect(isRetiredEvent('UI', 'Used', 'JustDraw')).toBe(true);
    expect(isRetiredEvent('UI', 'Used', 'TemplateLink')).toBe(false);
  });

  it('retires Settings › Experimental and its mode switches, not the modes', () => {
    expect(isRetiredEvent('UI', 'Opened', 'SettingsExperimental')).toBe(true);
    expect(isRetiredEvent('UI', 'Toggled', 'PagesModeOn')).toBe(true);
    expect(isRetiredEvent('UI', 'Toggled', 'PagesModeOff')).toBe(true);
    expect(isRetiredEvent('UI', 'Toggled', 'PlanModeOn')).toBe(true);
    expect(isRetiredEvent('UI', 'Toggled', 'PlanModeOff')).toBe(true);
    expect(isRetiredEvent('UI', 'Opened', 'SettingsAi')).toBe(false);
  });

  it('retires Pages mode, not the backgrounds and windows that outlive it', () => {
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
    expect(isRetiredEvent('Tab', 'Changed', 'PageBackgroundAnimated')).toBe(false);
    expect(isRetiredEvent('UI', 'Used', 'TabWindowOpen')).toBe(false);
    expect(isRetiredEvent('UI', 'Started', 'PlanTour')).toBe(false);
    expect(isRetiredEvent('Document', 'Exported', 'PNG')).toBe(false);
    expect(isRetiredEvent('Help', 'View', 'pages')).toBe(false);
  });

  it('retires the editor modes other than Plan, not what Plan still sends', () => {
    for (const type of ['ModeDiagram', 'ModeDraw', 'ModePages', 'ModePlan', 'ModeWorkshop'])
      expect(isRetiredEvent('Editor', 'Changed', type)).toBe(true);
    expect(isRetiredEvent('Editor', 'Changed', 'LeavePagesConfirmed')).toBe(true);
    expect(isRetiredEvent('Tab', 'Changed', 'ArticlesToPages')).toBe(true);
    expect(isRetiredEvent('UI', 'Used', 'StartOtherMode')).toBe(true);
    expect(isRetiredEvent('UI', 'Opened', 'ToolbarSearchUnavailable')).toBe(true);
    for (const mode of ['Diagram', 'Draw', 'Workshop', 'Pages']) {
      expect(isRetiredEvent('Folder', 'Changed', `DefaultMode${mode}`)).toBe(true);
      expect(isRetiredEvent('Folder', 'Cleared', `DefaultMode${mode}`)).toBe(true);
    }
    for (const tour of ['Draw', 'Pages', 'Workshop']) {
      expect(isRetiredEvent('UI', 'Opened', `${tour}TourOffer`)).toBe(true);
      expect(isRetiredEvent('UI', 'Closed', `${tour}TourOffer`)).toBe(true);
      expect(isRetiredEvent('UI', 'Started', `${tour}Tour`)).toBe(true);
      expect(isRetiredEvent('UI', 'Ended', `${tour}TourCompleted`)).toBe(true);
      expect(isRetiredEvent('UI', 'Ended', `${tour}TourSkipped`)).toBe(true);
      expect(isRetiredEvent('UI', 'View', `${tour}TourStepOutro`)).toBe(true);
      // Their Settings rows still send.
      expect(isRetiredEvent('UI', 'Toggled', `${tour}TourSeenOff`)).toBe(false);
    }
    expect(isRetiredEvent('Folder', 'Changed', 'DefaultModePlan')).toBe(false);
    expect(isRetiredEvent('Folder', 'Changed', 'DefaultKindEventStorming')).toBe(false);
    expect(isRetiredEvent('Tab', 'Changed', 'PageFitToContent')).toBe(false);
    expect(isRetiredEvent('UI', 'Changed', 'ToolbarCategory')).toBe(false);
    expect(isRetiredEvent('UI', 'Opened', 'ToolbarSearch')).toBe(false);
  });

  it("retires the removed modes' help articles, not the Plan tour's", () => {
    for (const id of ['editor-modes', 'diagram-tour']) {
      expect(isRetiredEvent('Help', 'View', id)).toBe(true);
      expect(isRetiredEvent('Help', 'Helpful', id)).toBe(true);
      expect(isRetiredEvent('Help', 'Unhelpful', id)).toBe(true);
      expect(isRetiredEvent('UI', 'Opened', id)).toBe(true);
    }
    expect(isRetiredEvent('Help', 'View', 'plan-tour')).toBe(false);
    expect(isRetiredEvent('Help', 'View', 'plan-mode')).toBe(false);
    expect(isRetiredEvent('UI', 'Opened', 'plan-tour')).toBe(false);
  });

  it('retires the Diagram tour, not the tours that carry on', () => {
    expect(isRetiredEvent('UI', 'Opened', 'TourOffer')).toBe(true);
    expect(isRetiredEvent('UI', 'Closed', 'TourOffer')).toBe(true);
    expect(isRetiredEvent('UI', 'Started', 'Tour')).toBe(true);
    expect(isRetiredEvent('UI', 'Ended', 'TourCompleted')).toBe(true);
    expect(isRetiredEvent('UI', 'Ended', 'TourSkipped')).toBe(true);
    expect(isRetiredEvent('UI', 'View', 'TourStepPalette')).toBe(true);
    expect(isRetiredEvent('UI', 'Toggled', 'TourSeenOff')).toBe(true);
    expect(isRetiredEvent('UI', 'Toggled', 'TourSeenOn')).toBe(true);
    expect(isRetiredEvent('UI', 'Opened', 'PlanTourOffer')).toBe(false);
    expect(isRetiredEvent('UI', 'Started', 'PlanTour')).toBe(false);
    expect(isRetiredEvent('UI', 'View', 'PlanTourStepBoard')).toBe(false);
    expect(isRetiredEvent('UI', 'View', 'SankeyTourStepOutro')).toBe(false);
    expect(isRetiredEvent('UI', 'Toggled', 'PlanTourSeenOff')).toBe(false);
  });

  it("retires Workshop mode's facilitation features, not the session tools Plan keeps", () => {
    expect(isRetiredEvent('Facilitator', 'Started', 'Claimed')).toBe(true);
    expect(isRetiredEvent('Tab', 'Started', 'Poll')).toBe(true);
    expect(isRetiredEvent('Canvas', 'Used', 'Laser')).toBe(true);
    expect(isRetiredEvent('Canvas', 'Used', 'FollowMe')).toBe(true);
    expect(isRetiredEvent('Element', 'Added', 'Quiz')).toBe(true);
    expect(isRetiredEvent('Element', 'Used', 'ReactionPad')).toBe(true);
    expect(isRetiredEvent('UI', 'Started', 'Presentation')).toBe(true);
    expect(isRetiredEvent('UI', 'Changed', 'AvatarClothing')).toBe(true);
    expect(isRetiredEvent('UI', 'View', 'WorkshopTourStepOutro')).toBe(true);
    expect(isRetiredEvent('Tab', 'Started', 'Vote')).toBe(false);
    expect(isRetiredEvent('Tab', 'Started', 'CountdownTimer')).toBe(false);
    expect(isRetiredEvent('Canvas', 'Used', 'Isometric')).toBe(false);
    expect(isRetiredEvent('Element', 'Added', 'Temperature')).toBe(false);
    expect(isRetiredEvent('Element', 'Added', 'Picker')).toBe(false);
    expect(isRetiredEvent('UI', 'Opened', 'SessionVote')).toBe(false);
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
