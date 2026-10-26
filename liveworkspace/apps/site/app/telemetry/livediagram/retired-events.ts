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

// Pages mode (removed 2026-10-22; its pages, articles, slide pages, infographics, logos and wireframes moved to
// livedocuments.app): switching a tab to Pages or opening it there, every page and article change, a logo page's
// tools and guides, a wireframe page's device, Contents, the Pages tour and each page kind's Show Me tour, the Tab Window (a live view of a tab on a slide or page) and its tour, the
// agents' page tools, the Pages help articles, a logo page's wordmark controls (tracking, weight, case, arc) and Tidy
// Up, a page's title-bar buttons, a page added to a deck as a slide, the agents' Pages view, and the Pages export
// formats (every page as PNG, SVG, PDF or GIF, the animated GIF and the logo kit). The Slide Deck, which presents a
// canvas, carries on. A form's cover took the animated background over until Plan mode left too, so those two
// Tab·Changed tokens are retired with it.
const PAGES_MODE_EDITOR_TYPES = new Set(['ModePages', 'LeavePagesConfirmed']);
const PAGES_MODE_TAB_TYPE =
  /^(OpensInPages|Page[A-Z]|Pages[A-Z]|Articles?[A-Z]|SlidePage|LogoPage|Wireframe[A-Z])/;
const PAGES_MODE_ELEMENT_TYPE =
  /^(Article[A-Z]|TabWindow|MirrorCopy$|MirrorTwin$|Shapes(United|Subtracted|Intersected|Excluded)$|Text(Tracking|Weight|Case|Arc)$|StrokesTidiedUp$)/;
const PAGES_MODE_UI_TYPE =
  /^(Logo[A-Z]|Wireframe[A-Z]|TabWindow|PagesTour|SlidesTour|SlideTour|InfographicTour|ArticleTour|Contents(Placement|Side)|EmptyPage|PageContents|PageSwipe|PageSlide$|AllPageSlides$|Page(ArticleStyle|ArticleText|Background|Layouts|Notes)Button$)/;
const PAGES_MODE_EXPORT_TYPE = /^(LogoKit|GIF|Pages(PNG|SVG|PDF|GIF)(Pages)?)$/;
// The agents' page tools: the MCP's change_pages and write_article, and the CLI's page and article verbs.
const PAGES_MODE_AGENT_TYPES = new Set([
  'Mcp|ChangePages',
  'Mcp|WriteArticle',
  'Cli|PageLs',
  'Cli|PageSet',
  'Cli|ArticleGet',
  'Cli|ArticleSet',
]);
const PAGES_MODE_HELP_IDS = new Set([
  'pages-mode',
  'infographic-layouts',
  'logo-pages',
  'wireframe-pages',
  'articles',
  'pages-tour',
  'exporting-pages',
  'slide-pages',
  'tab-windows',
]);

function isPagesModeEvent(category: string, action: string, type: string | null): boolean {
  const t = type ?? '';
  if (category === 'Editor') return PAGES_MODE_EDITOR_TYPES.has(t);
  if (category === 'Tab') return PAGES_MODE_TAB_TYPE.test(t);
  if (category === 'Element') return PAGES_MODE_ELEMENT_TYPE.test(t);
  if (category === 'Document') return action === 'Exported' && PAGES_MODE_EXPORT_TYPE.test(t);
  if (category === 'Agent') return action === 'Viewed' && t === 'Pages';
  if (category === 'Help') return PAGES_MODE_HELP_IDS.has(t);
  if (category === 'Mcp' || category === 'Cli')
    return PAGES_MODE_AGENT_TYPES.has(`${category}|${t}`);
  if (category === 'UI') {
    if (action === 'Opened' && PAGES_MODE_HELP_IDS.has(t)) return true;
    return PAGES_MODE_UI_TYPE.test(t);
  }
  return false;
}

// Plan mode (removed 2026-10-23; its boards, cards, Sheets, dashboards and forms moved to liveplanner.app): every
// Plan, Sheet, Form and Item event, switching a tab to Plan or opening it there, a card or a board added to a deck as
// a slide, a card opened from the Inbox, the Plan and Forms tours and their Settings rows, the form-response email
// switch, the agents' item, board, card-type, sheet and form tools, and the Plan help articles.
const PLAN_MODE_CATEGORIES = new Set(['Plan', 'Sheet', 'Form', 'Item']);
const PLAN_MODE_EDITOR_TYPES = new Set(['ModePlan']);
const PLAN_MODE_TAB_TYPES = new Set(['OpensInPlan']);
const PLAN_MODE_UI_TYPE =
  /^(PlanTour|FormTour|BoardsTour|SheetsTour|DashboardsTour|ItemSlide$|BoardSlide$|NotifyFormResponses)/;
const PLAN_MODE_AGENT_TYPE =
  /^(Mcp\|(ListItems|ChangeItems|AddBoard|ChangeBoard|ChangeCardTypes|ListSheets|ReadSheet|ChangeSheet|AddSheet|ReadForm|AddForm|ChangeForm|ShareForm|TryForm)|Cli\|(Item|Board|Sheet|Form|Type)[A-Z]\w*)$/;
const PLAN_MODE_HELP_IDS = new Set([
  'plan-mode',
  'items',
  'boards',
  'cards',
  'card-types',
  'plan-tour',
  'forms',
  'dashboards',
  'sheets',
  'sheet-functions',
  'visualisations',
  'plan-sheets-images',
]);

function isPlanModeEvent(category: string, action: string, type: string | null): boolean {
  const t = type ?? '';
  if (PLAN_MODE_CATEGORIES.has(category)) return true;
  if (category === 'Editor') return PLAN_MODE_EDITOR_TYPES.has(t);
  if (category === 'Tab') return PLAN_MODE_TAB_TYPES.has(t);
  if (category === 'Action') return action === 'Linked' && t === 'Board';
  if (category === 'Help') return PLAN_MODE_HELP_IDS.has(t);
  if (category === 'Mcp' || category === 'Cli')
    return PLAN_MODE_AGENT_TYPE.test(`${category}|${t}`);
  if (category === 'UI') {
    if (action === 'Opened' && PLAN_MODE_HELP_IDS.has(t)) return true;
    return PLAN_MODE_UI_TYPE.test(t);
  }
  return false;
}

// The in-editor AI assistant (removed 2026-10-23, docs/specs/021-event-storming/note-reader.md): its Ask and Clean
// requests, its Settings switches (the assistant and its suggested prompts), the AI Tools Settings category, and its
// help article. The sticky-note photo import still sends AI·Used under its Photo* types, and carries on.
const AI_ASSISTANT_USED_TYPES = new Set(['Ask', 'Clean']);
const AI_ASSISTANT_HELP_ID = 'ai-tools';

function isAiAssistantEvent(category: string, action: string, type: string | null): boolean {
  const t = type ?? '';
  if (category === 'AI') return action === 'Toggled' || AI_ASSISTANT_USED_TYPES.has(t);
  if (category === 'Help') return t === AI_ASSISTANT_HELP_ID;
  if (category === 'UI' && action === 'Opened')
    return t === 'SettingsAi' || t === AI_ASSISTANT_HELP_ID;
  return false;
}

// Tags (removed 2026-10-23, docs/specs/013-workspace/tags.md): coloured labels people put on their documents. A tag
// made, put on or taken off, renamed, recoloured or deleted, the sidebar's and the Explorer panel's Tags rows, and
// the Tags help article. Card tags on a canvas card are a different feature (Element·Changed·TagColour), and carry on.
const TAG_EXPLORER_TYPES = new Set(['Tag', 'TagColour']);
const TAG_SIDEBAR_TYPES = new Set([
  'Sidebar.Tags',
  'Sidebar.Tag',
  'ExplorerPanel.Tags',
  'ExplorerPanel.Tag',
]);
const TAGS_HELP_ID = 'tags';

function isTagsEvent(category: string, action: string, type: string | null): boolean {
  const t = type ?? '';
  if (category === 'Explorer') return TAG_EXPLORER_TYPES.has(t);
  if (category === 'Help') return t === TAGS_HELP_ID;
  if (category === 'UI') {
    if (action === 'Selected') return TAG_SIDEBAR_TYPES.has(t);
    return action === 'Opened' && t === TAGS_HELP_ID;
  }
  return false;
}

// livediagram's own Google Drive mirror (removed 2026-10-25, liveworkspace/docs/specs/005-drive/drive.md "Coming from livediagram's
// mirror"): every Drive event. Google Drive sync is liveworkspace's now, for every app, and sends none of these.
const DRIVE_MIRROR_CATEGORY = 'Drive';

export function isRetiredEvent(category: string, action: string, type: string | null): boolean {
  if (category === 'Document' && action === 'Reverted') return true;
  if (category === DRIVE_MIRROR_CATEGORY) return true;
  if (isTagsEvent(category, action, type)) return true;
  if (isAiAssistantEvent(category, action, type)) return true;
  if (isPagesModeEvent(category, action, type)) return true;
  if (isPlanModeEvent(category, action, type)) return true;
  if (category === 'UI' && PALETTE_FAVOURITES_UI.has(`${action}|${type ?? ''}`)) return true;
  if (category === 'UI' && EXPERIMENTAL_SETTINGS_UI.has(`${action}|${type ?? ''}`)) return true;
  if (category === 'UI' && LOCATION_STEP_AND_QUICK_START_UI.has(`${action}|${type ?? ''}`))
    return true;
  if (category === 'Help') {
    return ACTIVITY_PANEL_HELP_IDS.has(type ?? '') || type === PALETTE_FAVOURITES_HELP_ID;
  }
  if (category === 'UI' && (action === 'Opened' || action === 'Toggled')) {
    if (ACTIVITY_PANEL_UI_TYPES.has(type ?? '')) return true;
    return (
      action === 'Opened' &&
      (ACTIVITY_PANEL_HELP_IDS.has(type ?? '') || type === PALETTE_FAVOURITES_HELP_ID)
    );
  }
  return false;
}
