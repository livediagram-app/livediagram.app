import { describe, expect, it } from 'vitest';
import { metricKey, type TelemetrySummary } from '@livediagram/api-schema';
import { dropRetiredEvents as dropRetired } from '../_shared/retired-events';
import { isRetiredEvent } from './retired-events';

const dropRetiredEvents = (summary: TelemetrySummary) => dropRetired(summary, isRetiredEvent);

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
    expect(isRetiredEvent('Editor', 'Changed', 'ModeDraw')).toBe(false);
  });

  it('retires the in-editor AI assistant, not the photo import', () => {
    expect(isRetiredEvent('AI', 'Used', 'Ask')).toBe(true);
    expect(isRetiredEvent('AI', 'Used', 'Clean')).toBe(true);
    expect(isRetiredEvent('AI', 'Toggled', 'AiOn')).toBe(true);
    expect(isRetiredEvent('AI', 'Toggled', 'AiSuggestedPromptsOff')).toBe(true);
    expect(isRetiredEvent('UI', 'Opened', 'SettingsAi')).toBe(true);
    expect(isRetiredEvent('Help', 'View', 'ai-tools')).toBe(true);
    expect(isRetiredEvent('AI', 'Used', 'PhotoNotes')).toBe(false);
    expect(isRetiredEvent('AI', 'Used', 'PhotoDetectClassicalNoWorker')).toBe(false);
    expect(isRetiredEvent('Help', 'View', 'connect-ai-mcp')).toBe(false);
  });

  it('retires document tags, not card tags or the Explorer filters', () => {
    expect(isRetiredEvent('Explorer', 'Created', 'Tag')).toBe(true);
    expect(isRetiredEvent('Explorer', 'Added', 'Tag')).toBe(true);
    expect(isRetiredEvent('Explorer', 'Removed', 'Tag')).toBe(true);
    expect(isRetiredEvent('Explorer', 'Renamed', 'Tag')).toBe(true);
    expect(isRetiredEvent('Explorer', 'Changed', 'TagColour')).toBe(true);
    expect(isRetiredEvent('Explorer', 'Deleted', 'Tag')).toBe(true);
    expect(isRetiredEvent('UI', 'Selected', 'Sidebar.Tags')).toBe(true);
    expect(isRetiredEvent('UI', 'Selected', 'ExplorerPanel.Tags')).toBe(true);
    expect(isRetiredEvent('Help', 'View', 'tags')).toBe(true);
    expect(isRetiredEvent('UI', 'Opened', 'tags')).toBe(true);
    expect(isRetiredEvent('Element', 'Changed', 'TagColour')).toBe(false);
    expect(isRetiredEvent('Explorer', 'Selected', 'Text')).toBe(false);
    expect(isRetiredEvent('UI', 'Selected', 'Sidebar.Library')).toBe(false);
    expect(isRetiredEvent('Community', 'Selected', 'Tag')).toBe(false);
  });

  it("retires livediagram's own Google Drive mirror, every Drive event", () => {
    for (const action of ['Linked', 'Unlinked', 'Changed', 'Created', 'Applied', 'Opened'])
      expect(isRetiredEvent('Drive', action, null)).toBe(true);
    expect(isRetiredEvent('Drive', 'Applied', 'Rename')).toBe(true);
    // Agent changesets share the Applied action, and carry on.
    expect(isRetiredEvent('Agent', 'Applied', 'Mcp')).toBe(false);
  });

  it('keeps everything that still exists', () => {
    expect(isRetiredEvent('Document', 'Undone', null)).toBe(false);
    expect(isRetiredEvent('Help', 'View', 'undo')).toBe(false);
    expect(isRetiredEvent('UI', 'Opened', 'undo')).toBe(false);
    expect(isRetiredEvent('Activity', 'Opened', null)).toBe(false);
    expect(isRetiredEvent('UI', 'Opened', 'Settings')).toBe(false);
  });

  it('retires Pages mode, not the Slide Deck or the other modes', () => {
    expect(isRetiredEvent('Editor', 'Changed', 'ModePages')).toBe(true);
    expect(isRetiredEvent('Tab', 'Changed', 'OpensInPages')).toBe(true);
    expect(isRetiredEvent('Tab', 'Changed', 'PageLayout')).toBe(true);
    expect(isRetiredEvent('Tab', 'Changed', 'WireframeDeviceIphone')).toBe(true);
    expect(isRetiredEvent('Element', 'Added', 'ArticleImage')).toBe(true);
    expect(isRetiredEvent('Element', 'Created', 'MirrorTwin')).toBe(true);
    expect(isRetiredEvent('Document', 'Exported', 'LogoKit')).toBe(true);
    expect(isRetiredEvent('UI', 'Toggled', 'LogoGuidesOn')).toBe(true);
    expect(isRetiredEvent('UI', 'View', 'PagesTourStepAddPage')).toBe(true);
    expect(isRetiredEvent('UI', 'Started', 'SlideTour')).toBe(true);
    expect(isRetiredEvent('Help', 'View', 'pages-mode')).toBe(true);
    expect(isRetiredEvent('Mcp', 'Used', 'WriteArticle')).toBe(true);
    expect(isRetiredEvent('UI', 'Started', 'TabWindowTour')).toBe(true);
    expect(isRetiredEvent('Element', 'Changed', 'TabWindowTab')).toBe(true);
    expect(isRetiredEvent('Cli', 'Used', 'PageSet')).toBe(true);
    expect(isRetiredEvent('Mcp', 'Used', 'ReadDocument')).toBe(false);
    expect(isRetiredEvent('Editor', 'Changed', 'ModeDiagram')).toBe(false);
    expect(isRetiredEvent('UI', 'Opened', 'SlideDeck')).toBe(false);
    expect(isRetiredEvent('UI', 'Toggled', 'SlideHidden')).toBe(false);
  });

  it('retires the Pages leftovers: exports, wordmark controls, page buttons and page slides', () => {
    for (const t of ['GIF', 'PagesPNG', 'PagesPDFPages', 'PagesGIF', 'PagesSVGPages'])
      expect(isRetiredEvent('Document', 'Exported', t), t).toBe(true);
    for (const t of ['TextTracking', 'TextWeight', 'TextCase', 'TextArc', 'StrokesTidiedUp'])
      expect(isRetiredEvent('Element', 'Changed', t), t).toBe(true);
    expect(isRetiredEvent('UI', 'Opened', 'PageBackgroundButton')).toBe(true);
    expect(isRetiredEvent('UI', 'Added', 'PageSlide')).toBe(true);
    expect(isRetiredEvent('Tab', 'Changed', 'ArticlesToPages')).toBe(true);
    expect(isRetiredEvent('Agent', 'Viewed', 'Pages')).toBe(true);
    // Still sent: the other export formats, the other slides and the agents' other views.
    expect(isRetiredEvent('Document', 'Exported', 'PNG')).toBe(false);
    expect(isRetiredEvent('UI', 'Added', 'Slide')).toBe(false);
    expect(isRetiredEvent('Agent', 'Viewed', 'Outline')).toBe(false);
    expect(isRetiredEvent('Element', 'Changed', 'FormatPainter')).toBe(false);
    expect(isRetiredEvent('Help', 'View', 'slide-deck')).toBe(false);
    expect(isRetiredEvent('Element', 'Added', 'Page')).toBe(false);
  });

  it('retires Plan mode, not the other modes, the Slide Deck or the Workshop Q&A board', () => {
    expect(isRetiredEvent('Plan', 'Added', 'Task')).toBe(true);
    expect(isRetiredEvent('Sheet', 'Changed', 'Cell')).toBe(true);
    expect(isRetiredEvent('Form', 'Created', 'Feedback')).toBe(true);
    expect(isRetiredEvent('Editor', 'Changed', 'ModePlan')).toBe(true);
    expect(isRetiredEvent('Tab', 'Changed', 'OpensInPlan')).toBe(true);
    expect(isRetiredEvent('Tab', 'Changed', 'PageBackgroundAnimated')).toBe(true);
    expect(isRetiredEvent('UI', 'Added', 'BoardSlide')).toBe(true);
    expect(isRetiredEvent('UI', 'View', 'PlanTourStepBoard')).toBe(true);
    expect(isRetiredEvent('UI', 'Toggled', 'NotifyFormResponsesOn')).toBe(true);
    expect(isRetiredEvent('Action', 'Linked', 'Board')).toBe(true);
    expect(isRetiredEvent('Mcp', 'Used', 'AddSheet')).toBe(true);
    expect(isRetiredEvent('Cli', 'Used', 'ItemAdd')).toBe(true);
    expect(isRetiredEvent('Help', 'View', 'plan-mode')).toBe(true);
    expect(isRetiredEvent('Editor', 'Changed', 'ModeWorkshop')).toBe(false);
    expect(isRetiredEvent('Tab', 'Changed', 'OpensInDraw')).toBe(false);
    expect(isRetiredEvent('UI', 'Added', 'Slide')).toBe(false);
    expect(isRetiredEvent('UI', 'View', 'WorkshopTourStepTimer')).toBe(false);
    expect(isRetiredEvent('Mcp', 'Used', 'ReadDocument')).toBe(false);
    expect(isRetiredEvent('Cli', 'Used', 'TabView')).toBe(false);
    expect(isRetiredEvent('Help', 'View', 'editor-modes')).toBe(false);
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
