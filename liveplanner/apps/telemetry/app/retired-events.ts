import type { TelemetrySummary, TelemetryWindow } from '@liveplanner/api-schema';

// Events of features that no longer exist (docs/specs/017-telemetry/telemetry.md "Retired features").
// The stored rows stay in D1 until retention ages them out, but the dashboard
// treats the feature as gone: these events are dropped from the summary the
// moment it arrives, so no chart, stack, ranking or total ever renders them.
// Their explanation sentences stay in event-explanations.ts for Search.

// The editor's Activity panel (removed 2026-10-03, docs/specs/012-collaboration/README.md "Removed: the
// Activity panel"): its per-entry revert, the panel opening, its Settings
// rows, and its help articles. The Undo and Redo articles kept their slugs
// when they moved to Canvas, so their series carry on and are not listed.
const ACTIVITY_PANEL_HELP_IDS = new Set([
  'activity-panel',
  'what-it-is',
  'how-it-works',
  'reverting-changes',
]);
const ACTIVITY_PANEL_UI_TYPES = new Set([
  'Activity',
  'SettingsActivity',
  'ActivityPanelOn',
  'ActivityPanelOff',
  'ActivityRevertPreviewOn',
  'ActivityRevertPreviewOff',
]);

// The palette's Favourites (removed 2026-10-03, docs/specs/010-palette/palette-favourites.md): its
// curation (add, remove, reorder or reset, the Edit / Reorder modes), its cross-category search,
// and its help article (now Popular's, at a new address).
const PALETTE_FAVOURITES_UI = new Set([
  'Added|PaletteFavourite',
  'Removed|PaletteFavourite',
  'Changed|PaletteFavourite',
  'Toggled|PaletteFavouritesEdit',
  'Searched|PaletteSearch',
]);
const PALETTE_FAVOURITES_HELP_ID = 'favourites';

// Settings › Experimental (removed 2026-10-06, docs/specs/007-editor/editor-modes.md "Every mode,
// always offered"): the category opening and its Pages Mode and Plan Mode switches. Every mode
// is always offered now; the modes themselves, and their own events, carry on.
const EXPERIMENTAL_SETTINGS_UI = new Set([
  'Opened|SettingsExperimental',
  'Toggled|PagesModeOn',
  'Toggled|PagesModeOff',
  'Toggled|PlanModeOn',
  'Toggled|PlanModeOff',
]);

// The New Document wizard's Location step and the editor's Quick Start (removed 2026-10-16,
// docs/specs/007-editor/new-document-route.md "One-step wizard"): "Always save new documents in <place> and skip this
// step" and Settings' Turn Off, the Quick Start shelf's expand toggle and its mode filter. Templates are picked on each
// mode's start now, whose search reaches the other modes (UI·Used·StartOtherMode).
const LOCATION_STEP_AND_QUICK_START_UI = new Set([
  'Toggled|SkipLocationStepOn',
  'Toggled|SkipLocationStepOff',
  'Toggled|TemplateShelfExpanded',
  'Toggled|TemplateShelfCollapsed',
  'Toggled|TemplateModeAll',
  'Toggled|TemplateModeDiagram',
  'Toggled|TemplateModeDraw',
  'Toggled|TemplateModeWorkshop',
  'Toggled|TemplateModePages',
  'Toggled|TemplateModePlan',
]);

// Workshop mode's facilitation features (removed 2026-10-21, docs/specs/017-telemetry/telemetry.md "Retired
// features"): the facilitator role, live polls, the Laser, Spotlight and Avatar modes and their panels, follow-me,
// presentations and the slide deck, the Workshop and Avatar tours, and the Behaviour and Collaborate elements that
// went with them. The timer, the dot vote, session buttons, pickers, temperature checks and decision records carry on.
const WORKSHOP_CANVAS_TYPES = new Set([
  'Laser',
  'Spotlight',
  'AvatarMode',
  'AvatarMessage',
  'AvatarMessagePanel',
  'AvatarPadArrival',
  'FollowMe',
  'WaterCooler',
  'CoffeeMachine',
]);
const WORKSHOP_ELEMENT_TYPES = new Set([
  'Agenda',
  'AvatarPad',
  'Avatar-pad',
  'Bookshelf',
  'BringFocus',
  'Chair',
  'CoffeeMachine',
  'Coffee-machine',
  'Desk',
  'DoneCheck',
  'Done-check',
  'Estimate',
  'Fence',
  'FocusButton',
  'Focus-button',
  'IdeaBox',
  'Idea-box',
  'MeetingTable',
  'Meeting-table',
  'ModeButton',
  'Mode-button',
  'Plant',
  'PollResult',
  'QaBoard',
  'Qa-board',
  'Quiz',
  'ReactionPad',
  'Reaction-pad',
  'Reveal',
  'RollCall',
  'Roll-call',
  'Room',
  'Rug',
  'Sofa',
  'WaterCooler',
  'Water-cooler',
]);
const WORKSHOP_UI = new Set([
  'Opened|SessionPoll',
  'Opened|SlideDeck',
  'Opened|PresentationSettings',
  'Opened|PresenterNotes',
  'Opened|SlideElementDetail',
  'Opened|HeaderPresent',
  'Opened|AvatarPanel',
  'Started|Presentation',
  'Closed|Presentation',
  'Added|Slide',
  'Added|PageSlide',
  'Added|ItemSlide',
  'Added|BoardSlide',
  'Added|AllPageSlides',
  'Removed|Slide',
  'Moved|Slide',
  'Toggled|SlideShown',
  'Toggled|SlideHidden',
  'Changed|SlideNotes',
  'Selected|WorkshopTourFromWelcome',
]);
// The UI types the removed features sent under a prefix: a mode's options, a costume, a presenter setting, a tour.
const WORKSHOP_UI_PREFIXES = ['Laser', 'Spotlight', 'Avatar', 'Presentation-', 'WorkshopTour'];

function isRetiredWorkshopEvent(category: string, action: string, type: string | null): boolean {
  const t = type ?? '';
  if (category === 'Facilitator') return true;
  if (category === 'Canvas') return action === 'Used' && WORKSHOP_CANVAS_TYPES.has(t);
  if (category === 'Element') return WORKSHOP_ELEMENT_TYPES.has(t);
  if (category === 'Tab') return t === 'Poll';
  if (category !== 'UI') return false;
  return WORKSHOP_UI.has(`${action}|${t}`) || WORKSHOP_UI_PREFIXES.some((p) => t.startsWith(p));
}

// The New Document wizard itself (removed 2026-10-21, docs/specs/007-editor/new-document-route.md "Creating on
// arrival"): its Escape / X back-out and the Start Blank link that skipped it. /new asks nothing now; a template link
// carries on (UI·Used·TemplateLink).
const NEW_DOCUMENT_WIZARD_UI = new Set(['Closed|NewDocument', 'Used|JustDraw']);
// Pages mode (removed 2026-10-22, docs/specs/017-telemetry/telemetry.md "Retired features"): its pages, slide pages,
// articles, logos, wireframes and infographics, their exports, tours and settings, and the agent tools that wrote
// them. A form cover's moving background and Tab Windows carry on.
const PAGES_MODE_EVENTS = new Set([
  'Agent|Viewed|Pages',
  'Cli|Used|PageLs',
  'Cli|Used|PageSet',
  'Cli|Used|ArticleGet',
  'Cli|Used|ArticleSet',
  'Document|Exported|LogoKit',
  'Editor|Changed|LeavePagesConfirmed',
  'Element|Changed|MirrorCopy',
  'Element|Changed|ShapesExcluded',
  'Element|Changed|ShapesIntersected',
  'Element|Changed|ShapesSubtracted',
  'Element|Changed|ShapesUnited',
  'Element|Changed|StrokesTidiedUp',
  'Element|Changed|TextArc',
  'Element|Changed|TextCase',
  'Element|Changed|TextTracking',
  'Element|Changed|TextWeight',
  'Element|Created|MirrorTwin',
  'Mcp|Used|ChangePages',
  'Mcp|Used|WriteArticle',
  'Tab|Aligned|PageTidyUp',
  'Tab|Changed|ArticleAdded',
  'Tab|Changed|ArticlesToPages',
  'Tab|Changed|ArticleStyle',
  'Tab|Changed|LogoPageAdded',
  'Tab|Changed|PageAdded',
  'Tab|Changed|PageAddedLikeLast',
  'Tab|Changed|PageBackground',
  'Tab|Changed|PageBackgroundAppliedToAll',
  'Tab|Changed|PageBackgroundImage',
  'Tab|Changed|PageBackgroundPainted',
  'Tab|Changed|PageDuplicated',
  'Tab|Changed|PageLandscape',
  'Tab|Changed|PageLayout',
  'Tab|Changed|PageLayoutSurprise',
  'Tab|Changed|PageLocked',
  'Tab|Changed|PageMoved',
  'Tab|Changed|PagePattern',
  'Tab|Changed|PagePortrait',
  'Tab|Changed|PageRemoved',
  'Tab|Changed|PageRenamed',
  'Tab|Changed|PageSize',
  'Tab|Changed|PagesLaidOut',
  'Tab|Changed|PageUnlocked',
  'Tab|Changed|SlidePageAdded',
  'Tab|Changed|WireframePageAdded',
  'UI|Added|AllPageSlides',
  'UI|Added|PageSlide',
  'UI|Closed|EmptyPageLayouts',
  'UI|Closed|EmptyPageLayoutsBlank',
  'UI|Closed|PagesTourOffer',
  'UI|Opened|EmptyPageInvite',
  'UI|Opened|PageArticleStyleButton',
  'UI|Opened|PageArticleTextButton',
  'UI|Opened|PageBackgroundButton',
  'UI|Opened|PageContents',
  'UI|Opened|PageLayoutsButton',
  'UI|Opened|PageNotesButton',
  'UI|Opened|PagesTourOffer',
  'UI|Toggled|WireframeSystemBarsOn',
  'UI|Toggled|WireframeSystemBarsOff',
  'UI|Used|PageContentsJump',
  'UI|Used|PageContentsReorder',
  'UI|Used|PageSwipe',
]);
// The families: each page kind's tour (offered, started, stepped, ended, and its Settings switch), the pages'
// exports (`PagesPNG`, `PagesPDFPages`, ...), the page kinds and wireframe frames, the article's inserts, formatting
// and looks, the logo guides and mirror, and where Contents docked.
const PAGES_MODE_FAMILIES =
  /^(UI\|(Started|Ended)\|(Pages|Slide|Infographic|Article|Logo)Tour\w*|UI\|View\|PagesTourStep\w+|UI\|Toggled\|(Pages|Slides|Infographic|Article|Logo)TourSeen(On|Off)|Document\|Exported\|Pages(PNG|SVG|PDF|GIF)\w*|Tab\|Changed\|(PageKind|WireframeDevice|WireframeFrame|ArticleLook)\w+|Element\|(Added|Changed)\|Article[A-Z]\w*|UI\|(Toggled|Changed)\|Logo(Guide|Mirror)\w*|UI\|Changed\|Contents(Placement|Side)\w+)$/;
const isPagesModeEvent = (key: string) =>
  PAGES_MODE_EVENTS.has(key) || PAGES_MODE_FAMILIES.test(key);

// The editor modes other than Plan (removed 2026-10-22, docs/specs/026-plan/plan-mode.md): every tab is a Plan tab, so
// the mode switch and its Editor·Changed series (each mode, and leaving Pages past its warning) went with them, as did
// the switch's turning of articles into pages, a start's templates from other modes, the toolbar search's "not in
// this mode" note, the other modes' default-folder keys, and the Draw, Pages and Workshop tours' offers, starts,
// ends and steps, and their Settings rows' seen-flag toggles. A Pages tab's board
// put onto a page as it loads (Tab·Changed·PageFitToContent) and the toolbar's category picker carry on too.
const EDITOR_MODES_UI = new Set([
  'Used|StartOtherMode',
  'Opened|ToolbarSearchUnavailable',
  'Opened|DrawTourOffer',
  'Closed|DrawTourOffer',
  'Started|DrawTour',
  'Ended|DrawTourCompleted',
  'Ended|DrawTourSkipped',
  'Opened|PagesTourOffer',
  'Closed|PagesTourOffer',
  'Started|PagesTour',
  'Ended|PagesTourCompleted',
  'Ended|PagesTourSkipped',
  'Opened|WorkshopTourOffer',
  'Closed|WorkshopTourOffer',
  'Started|WorkshopTour',
  'Ended|WorkshopTourCompleted',
  'Ended|WorkshopTourSkipped',
  'Toggled|DrawTourSeenOff',
  'Toggled|DrawTourSeenOn',
  'Toggled|WorkshopTourSeenOff',
  'Toggled|WorkshopTourSeenOn',
]);
const EDITOR_MODES_TOUR_STEP_PREFIXES = ['DrawTourStep', 'PagesTourStep', 'WorkshopTourStep'];
const EDITOR_MODES_DEFAULT_FOLDER_TYPES = new Set([
  'DefaultModeDiagram',
  'DefaultModeDraw',
  'DefaultModeWorkshop',
  'DefaultModePages',
]);

// The Diagram tour (removed 2026-10-22 with the Diagram mode, docs/specs/026-plan/plan-mode.md; the welcome tour
// until October 2026): its offer, start, end and each step's view, and its Settings row. The Plan, Forms and
// element tours carry on under their own tokens.
const DIAGRAM_TOUR_UI = new Set([
  'Opened|TourOffer',
  'Closed|TourOffer',
  'Started|Tour',
  'Ended|TourCompleted',
  'Ended|TourSkipped',
  'Toggled|TourSeenOff',
  'Toggled|TourSeenOn',
]);

// The help articles that went with them: canvas/editor-modes and getting-started/diagram-tour (the welcome tour's
// old address now redirects to the Plan tour's article, which reports under its own slug).
const EDITOR_MODES_HELP_IDS = new Set(['editor-modes', 'diagram-tour']);

function isRetiredEditorModeEvent(category: string, action: string, type: string | null): boolean {
  if (category === 'Editor') return true;
  if (category === 'Tab') return action === 'Changed' && type === 'ArticlesToPages';
  if (category === 'Folder') {
    return (
      (action === 'Changed' || action === 'Cleared') &&
      EDITOR_MODES_DEFAULT_FOLDER_TYPES.has(type ?? '')
    );
  }
  if (category !== 'UI') return false;
  const key = `${action}|${type ?? ''}`;
  if (EDITOR_MODES_UI.has(key) || DIAGRAM_TOUR_UI.has(key)) return true;
  if (action !== 'View' || !type) return false;
  return (
    type.startsWith('TourStep') || EDITOR_MODES_TOUR_STEP_PREFIXES.some((p) => type.startsWith(p))
  );
}

// The Explorer's Timeline section (removed 2026-10-22, docs/specs/013-workspace/timeline.md): its
// page arrivals, its card and stack menus and their Remove from Timeline, its sidebar rows and its
// page view. A document's History and a team's Activity draw the same feed and keep the rest of the
// Timeline category (Changed, Selected, Loaded, Opened·Stack).
const EXPLORER_TIMELINE = new Set([
  'Timeline|Opened|Landing',
  'Timeline|Opened|Nav',
  'Timeline|Opened|Menu',
  'Timeline|Removed|Entry',
  'Timeline|Removed|Stack',
  'UI|Selected|Sidebar.Timeline',
  'UI|Selected|ExplorerPanel.Timeline',
  'Page|View|/explorer/timeline',
]);

// The agents' icon search (removed 2026-10-22, docs/specs/015-api/mcp-server.md): the MCP's search_icons and the CLI's
// `icon search`, which found ids for diagram boxes.
const AGENT_ICON_SEARCH = new Set(['Mcp|Used|SearchIcons', 'Cli|Used|IconSearch']);

// liveplanner's diagram elements used in place (removed 2026-10-22, plans/0001-liveplanner-fork.md Phase 4): playing a
// video, a reaction pad, Bring into Focus. No Plan element sends `Element·Used`.
const isElementUsedInPlace = (category: string, action: string) =>
  category === 'Element' && action === 'Used';

// The dashboard's Draw Mode stack and the chrome it counted (removed 2026-10-22, plans/0001-liveplanner-fork.md
// Phase 4): a tab's Opens in mode, a board put onto a page that fits it, a tab opened from a Tab Window, the Toolbar
// layout's category switch and the whiteboard dock's position. A form cover's moving background carries on.
const DRAW_MODE_EVENTS = new Set([
  'Tab|Changed|PageFitToContent',
  'UI|Used|TabWindowOpen',
  'UI|Changed|ToolbarCategory',
]);
const isRetiredDrawModeEvent = (category: string, action: string, type: string | null) =>
  DRAW_MODE_EVENTS.has(`${category}|${action}|${type ?? ''}`) ||
  (category === 'Tab' && action === 'Changed' && (type ?? '').startsWith('OpensIn')) ||
  (category === 'UI' && action === 'Changed' && (type ?? '').startsWith('WhiteboardDockPosition'));

// The diagram lint (removed 2026-10-22, plans/0001-liveplanner-fork.md Phase 4): the agents' `view=lint` and the CLI's
// `tab lint`.
const DIAGRAM_LINT_EVENTS = new Set(['Agent|Viewed|Lint', 'Cli|Used|TabLint']);

// liveplanner's diagram tours and palette (removed 2026-10-22, plans/0001-liveplanner-fork.md Phase 4): the element
// tours offered beside a selected diagram element, the Tab Style dialog's Show Me, their Settings switches, and the
// strip palette's Icons, Stickers and Technology searches and groups. Each tour's events carry its token as the type
// or its prefix (`SankeyTourOffer`, `PyramidTourStepAddRow`, `ElementToursSeenOn`).
const RETIRED_TOUR_TOKENS = [
  'SankeyTour',
  'LayerStackTour',
  'PyramidTour',
  'FunnelTour',
  'CycleTour',
  'HubTour',
  'OnionTour',
  'ChevronsTour',
  'TimelineTour',
  'MindMapTour',
  'FlowchartTour',
  'OrgChartTour',
  'SequenceTour',
  'ChartTour',
  'StackTour',
  'EntityTour',
  'TabWindowTour',
  'LaneTour',
  'BoundaryTour',
  'DiagramKeyTour',
  'PortalTour',
  'TabStyleTour',
  'ElementTours',
];
const DIAGRAM_PALETTE_UI = new Set([
  'Searched|IconSearch',
  'Searched|TechSearch',
  'Searched|StickerSearch',
  'Opened|IconGroup',
  'Opened|TechGroup',
  'Opened|StickerGroup',
]);
function isRetiredDiagramTourEvent(category: string, action: string, type: string | null): boolean {
  if (category !== 'UI' || !type) return false;
  if (DIAGRAM_PALETTE_UI.has(`${action}|${type}`)) return true;
  return RETIRED_TOUR_TOKENS.some((token) => type.startsWith(token));
}

export function isRetiredEvent(category: string, action: string, type: string | null): boolean {
  if (isRetiredDiagramTourEvent(category, action, type)) return true;
  if (AGENT_ICON_SEARCH.has(`${category}|${action}|${type ?? ''}`)) return true;
  if (isElementUsedInPlace(category, action)) return true;
  if (isRetiredDrawModeEvent(category, action, type)) return true;
  if (DIAGRAM_LINT_EVENTS.has(`${category}|${action}|${type ?? ''}`)) return true;
  if (isRetiredWorkshopEvent(category, action, type)) return true;
  if (category === 'Document' && action === 'Reverted') return true;
  if (EXPLORER_TIMELINE.has(`${category}|${action}|${type ?? ''}`)) return true;
  if (isPagesModeEvent(`${category}|${action}|${type ?? ''}`)) return true;
  if (isRetiredEditorModeEvent(category, action, type)) return true;
  if (category === 'UI' && PALETTE_FAVOURITES_UI.has(`${action}|${type ?? ''}`)) return true;
  if (category === 'UI' && EXPERIMENTAL_SETTINGS_UI.has(`${action}|${type ?? ''}`)) return true;
  if (category === 'UI' && LOCATION_STEP_AND_QUICK_START_UI.has(`${action}|${type ?? ''}`))
    return true;
  if (category === 'UI' && NEW_DOCUMENT_WIZARD_UI.has(`${action}|${type ?? ''}`)) return true;
  if (category === 'Help') {
    return (
      ACTIVITY_PANEL_HELP_IDS.has(type ?? '') ||
      type === PALETTE_FAVOURITES_HELP_ID ||
      EDITOR_MODES_HELP_IDS.has(type ?? '')
    );
  }
  if (category === 'UI' && (action === 'Opened' || action === 'Toggled')) {
    if (ACTIVITY_PANEL_UI_TYPES.has(type ?? '')) return true;
    return (
      action === 'Opened' &&
      (ACTIVITY_PANEL_HELP_IDS.has(type ?? '') ||
        type === PALETTE_FAVOURITES_HELP_ID ||
        EDITOR_MODES_HELP_IDS.has(type ?? ''))
    );
  }
  return false;
}

function dropFromWindow(window: TelemetryWindow): TelemetryWindow {
  let dropped = 0;
  const rows = window.rows.filter((r) => {
    if (!isRetiredEvent(r.category, r.action, r.type)) return true;
    dropped += r.count;
    return false;
  });
  return dropped === 0 ? window : { total: window.total - dropped, rows };
}

const splitKey = (key: string): [string, string, string | null] => {
  const [category = '', action = '', type = ''] = key.split('|');
  return [category, action, type === '' ? null : type];
};

// The summary without any retired event: window rows and totals, the
// previous windows behind the trend arrows, and the daily series (each
// retired series also comes off its category's line and the day totals).
export function dropRetiredEvents(summary: TelemetrySummary): TelemetrySummary {
  // A deployment with telemetry off answers `{ enabled: false }` and nothing else: there is nothing to drop, and
  // reading its absent windows threw, which the dashboard took for a failed request ("Couldn't load the
  // numbers") instead of showing that telemetry is off here.
  if (!summary.enabled || !summary.windows) return summary;
  const windows = Object.fromEntries(
    Object.entries(summary.windows).map(([k, w]) => [k, dropFromWindow(w)]),
  ) as TelemetrySummary['windows'];
  const previousWindows = summary.previousWindows
    ? (Object.fromEntries(
        Object.entries(summary.previousWindows).map(([k, w]) => [k, dropFromWindow(w)]),
      ) as TelemetrySummary['previousWindows'])
    : undefined;
  let daily = summary.daily;
  if (daily) {
    const retired = Object.keys(daily.byMetric).filter((key) => isRetiredEvent(...splitKey(key)));
    if (retired.length > 0) {
      const byMetric = { ...daily.byMetric };
      const byCategory = { ...daily.byCategory };
      const totals = [...daily.totals];
      for (const key of retired) {
        const series = byMetric[key] ?? [];
        delete byMetric[key];
        const [category] = splitKey(key);
        const line = byCategory[category];
        if (line) byCategory[category] = line.map((n, i) => Math.max(0, n - (series[i] ?? 0)));
        series.forEach((n, i) => {
          totals[i] = Math.max(0, (totals[i] ?? 0) - n);
        });
      }
      daily = { ...daily, byMetric, byCategory, totals };
    }
  }
  return {
    ...summary,
    windows,
    ...(previousWindows ? { previousWindows } : {}),
    ...(daily ? { daily } : {}),
  };
}
