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

// Settings › Experimental (removed 2026-10-06): the category opening and its Pages Mode and Plan
// Mode switches. Pages is the one mode now (docs/specs/007-editor/pages-mode.md "One mode").
const EXPERIMENTAL_SETTINGS_UI = new Set([
  'Opened|SettingsExperimental',
  'Toggled|PagesModeOn',
  'Toggled|PagesModeOff',
  'Toggled|PlanModeOn',
  'Toggled|PlanModeOff',
]);

// The New Design wizard's Location step and the editor's Quick Start (removed 2026-10-16,
// docs/specs/007-editor/new-design-route.md "One-step wizard"): "Always save new designs in <place> and skip this
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

// Custom themes (removed 2026-10-23, livedesign docs/specs/011-theme/retired-schemes.md): the builder's
// lifecycle (created, applied, edited, deleted), the Explorer's Themes page row in the sidebar and the
// editor's Explorer panel, the failed calls to the routes that served them, and their two help articles.
const CUSTOM_THEME_TYPES = new Set(['Custom', 'CustomEdited']);
const CUSTOM_THEME_UI = new Set(['Selected|Sidebar.Themes', 'Selected|ExplorerPanel.Themes']);
const CUSTOM_THEME_HELP_IDS = new Set(['custom-themes', 'themes-library']);
const CUSTOM_THEME_ROUTE = /(?:^|\.)(?:List|Create|Update|Delete)CustomThemes?(?:\.|$)/;

function isRetiredCustomTheme(category: string, action: string, type: string | null): boolean {
  if (category === 'Theme') {
    return action === 'Created' || action === 'Deleted' || CUSTOM_THEME_TYPES.has(type ?? '');
  }
  if (category === 'UI' && CUSTOM_THEME_UI.has(`${action}|${type ?? ''}`)) return true;
  if (category === 'Help' || (category === 'UI' && action === 'Opened')) {
    if (CUSTOM_THEME_HELP_IDS.has(type ?? '')) return true;
  }
  return category === 'Error' && CUSTOM_THEME_ROUTE.test(type ?? '');
}

// The editor's AI assistant (removed 2026-10-23; AI tools connect over MCP, docs/specs/015-api/mcp-server.md):
// its Ask and Clean requests and its Settings switches (the whole `AI` category), the AI Tools Settings
// category opening, its help articles, and the failed calls to the route that served it.
const AI_ASSISTANT_HELP_IDS = new Set(['ai', 'ai-tools']);
const AI_ASSISTANT_ROUTE = /(?:^|\.)(?:Post\.Ai|AiStream)(?:\.|$)/;

function isRetiredAiAssistant(category: string, action: string, type: string | null): boolean {
  if (category === 'AI') return true;
  if (category === 'UI' && action === 'Opened' && type === 'SettingsAi') return true;
  if (category === 'Help' || (category === 'UI' && action === 'Opened')) {
    if (AI_ASSISTANT_HELP_IDS.has(type ?? '')) return true;
  }
  return category === 'Error' && AI_ASSISTANT_ROUTE.test(type ?? '');
}

// Slide decks and presenting (removed 2026-10-25, livedesign docs/specs/012-collaboration/presentation-mode.md):
// building a deck, running one, the presenter settings (the controls' cog and Settings › Presenting), the Pages
// tour's Slides steps, the Presentation render area's errors, and the Slide Deck help articles.
const SLIDE_DECK_UI = new Set([
  'Opened|SlideDeck',
  'Added|Slide',
  'Added|PageSlide',
  'Removed|Slide',
  'Moved|Slide',
  'Toggled|SlideHidden',
  'Toggled|SlideShown',
  'Changed|SlideNotes',
  'Opened|PageNotesButton',
  'Opened|HeaderPresent',
  'Started|Presentation',
  'Closed|Presentation',
  'Opened|PresenterNotes',
  'Opened|PresentationSettings',
  'Opened|SlideElementDetail',
  'Opened|SettingsPresenting',
  'View|PagesTourStepSlides',
  'View|PagesTourStepWireframePresent',
]);
const SLIDE_DECK_HELP_IDS = new Set([
  'slide-deck',
  'building-a-deck',
  'presenting',
  'presenter-controls',
]);

function isRetiredSlideDeck(category: string, action: string, type: string | null): boolean {
  const t = type ?? '';
  if (category === 'UI') {
    if (SLIDE_DECK_UI.has(`${action}|${t}`)) return true;
    // The presenter settings: `Changed·Presentation-<field>[<Option>]`, `Toggled·Presentation-<field>On|Off`.
    if ((action === 'Changed' || action === 'Toggled') && t.startsWith('Presentation-'))
      return true;
  }
  if (category === 'Help' || (category === 'UI' && action === 'Opened')) {
    if (SLIDE_DECK_HELP_IDS.has(t)) return true;
  }
  return category === 'Error' && action === 'Client' && t.startsWith('Render.Presentation.');
}
// The isometric view (removed 2026-10-25, docs/specs/008-canvas/canvas-and-palette.md "Retired features"; livediagram
// keeps it): the canvas tool, the image export's Isometric view toggle and the tool's help article.
const ISOMETRIC_VIEW = new Set(['Canvas|Used|Isometric', 'UI|Toggled|IsometricExport']);
const ISOMETRIC_HELP_ID = 'isometric-mode';

export function isRetiredEvent(category: string, action: string, type: string | null): boolean {
  if (ISOMETRIC_VIEW.has(`${category}|${action}|${type ?? ''}`)) return true;
  if (
    (category === 'Help' || (category === 'UI' && action === 'Opened')) &&
    type === ISOMETRIC_HELP_ID
  )
    return true;
  if (category === 'Document' && action === 'Reverted') return true;
  if (isRetiredSlideDeck(category, action, type)) return true;
  if (isRetiredAiAssistant(category, action, type)) return true;
  if (isRetiredCustomTheme(category, action, type)) return true;
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
