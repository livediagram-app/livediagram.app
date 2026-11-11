// Events of features that no longer exist (docs/specs/017-telemetry/telemetry.md "Retired features").
// The stored rows stay in D1 until retention ages them out, but the dashboard
// treats the feature as gone: these events are dropped from the summary the
// moment it arrives, so no chart, stack, ranking or total ever renders them.
// Their explanation sentences stay in event-explanations.ts for Search.

import { isRetiredTimelineEvent } from '../_shared/retired-timeline';

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

// Custom themes (removed 2026-10-23, livedocuments docs/specs/011-theme/retired-schemes.md): the builder's
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

// The editor's AI assistant (removed 2026-10-22; AI tools connect over MCP, docs/specs/015-api/mcp-server.md):
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

// The isometric view (removed 2026-10-25, docs/specs/008-canvas/canvas-and-palette.md "Retired features"; livediagram
// keeps it): the canvas tool, the image export's Isometric view toggle and the tool's help article. The Isometric
// background pattern followed later that day (the same section): no picker offers it, so picking it, Canvas·Changed·
// Isometric, is no longer sent.
const ISOMETRIC_VIEW = new Set([
  'Canvas|Used|Isometric',
  'UI|Toggled|IsometricExport',
  'Canvas|Changed|Isometric',
]);
const ISOMETRIC_HELP_ID = 'isometric-mode';

// The Tab Window (removed 2026-11-04, livedocuments docs/specs/009-elements/tab-window.md): one added, its tab chosen,
// the tab opened from it, its element tour (offer, start, steps, end and Settings switch, each carrying the
// `TabWindowTour` token as its type or its prefix) and its help article.
const TAB_WINDOW_EVENTS = new Set([
  'Element|Added|TabWindow',
  'Element|Changed|TabWindowTab',
  'UI|Used|TabWindowOpen',
]);
const TAB_WINDOW_HELP_ID = 'tab-windows';

// Element links and notes (removed 2026-11-04, livedocuments docs/specs/009-elements/links-and-notes-retired.md):
// the whole `Note` category (added, changed, deleted, opened, and its rich-text commands) and the Links, Notes and
// Linking Across Tabs help articles. Link cards and videos keep their links, so Element·Linked carries on.
const LINKS_AND_NOTES_HELP_IDS = new Set(['links', 'notes', 'linking-tabs']);

function isRetiredLinksAndNotes(category: string, action: string, type: string | null): boolean {
  if (category === 'Note') return true;
  return (
    (category === 'Help' || (category === 'UI' && action === 'Opened')) &&
    LINKS_AND_NOTES_HELP_IDS.has(type ?? '')
  );
}

function isRetiredTabWindow(category: string, action: string, type: string | null): boolean {
  if (TAB_WINDOW_EVENTS.has(`${category}|${action}|${type ?? ''}`)) return true;
  if (category === 'UI' && (type ?? '').startsWith('TabWindowTour')) return true;
  return (
    (category === 'Help' || (category === 'UI' && action === 'Opened')) &&
    type === TAB_WINDOW_HELP_ID
  );
}

// The Slide Deck panel (removed 2026-11-04, livedocuments docs/specs/007-editor/pages-mode.md "Retired: the Slide Deck
// panel"; the deck is built in Contents): the panel opening, its slides made from a selection or copied, deleted,
// dragged or all added at once, and the slides tour's two steps that walked it. Hiding a slide, adding a page and the
// header's Present carry on.
const SLIDE_DECK_PANEL_EVENTS = new Set([
  'UI|Opened|SlideDeck',
  'UI|Added|Slide',
  'UI|Removed|Slide',
  'UI|Moved|Slide',
  'UI|Added|AllPageSlides',
  'UI|View|PagesTourStepSlideDeck',
  'UI|View|PagesTourStepSlideShowSettings',
]);

// The in-page layout card (removed with Work Tracker #172, livedocuments docs/specs/007-editor/pages-mode.md "Layouts";
// retired here by #242): hiding the Start From a Layout card on an empty page, and Choose a Layout on a page too small
// on screen for it. Their explanation sentences went too. livediagram and livedesign still send both.
const EMPTY_PAGE_LAYOUT_EVENTS = new Set([
  'UI|Closed|EmptyPageLayouts',
  'UI|Opened|EmptyPageInvite',
]);

// The Layers panel (removed 2026-11-08, livedocuments docs/specs/006-document/layers.md "Retired: the Layers panel"): every
// `Layer` event the panel and the element menus' Move to Layer sent (added, selected, renamed by hand, deleted,
// toggled, merged, opacity, cleared, reordered, moved, the panel opened), its four Settings switches and the image
// export's Hidden layers option. Smart naming, Layer·Renamed·Adopted, is still sent and carries on.
const LAYERS_PANEL_UI = new Set([
  'Toggled|LayersPanelOn',
  'Toggled|LayersPanelOff',
  'Toggled|LayerPreviewOn',
  'Toggled|LayerPreviewOff',
  'Toggled|LayerCountOn',
  'Toggled|LayerCountOff',
  'Toggled|LayerHoverPreviewOn',
  'Toggled|LayerHoverPreviewOff',
  'Toggled|HiddenLayersExport',
]);

function isRetiredLayersPanel(category: string, action: string, type: string | null): boolean {
  if (category === 'Layer') return !(action === 'Renamed' && type === 'Adopted');
  return category === 'UI' && LAYERS_PANEL_UI.has(`${action}|${type ?? ''}`);
}

export function isRetiredEvent(category: string, action: string, type: string | null): boolean {
  if (isRetiredTimelineEvent(category, action, type)) return true;
  if (isRetiredLayersPanel(category, action, type)) return true;
  if (isRetiredTabWindow(category, action, type)) return true;
  if (isRetiredLinksAndNotes(category, action, type)) return true;
  if (SLIDE_DECK_PANEL_EVENTS.has(`${category}|${action}|${type ?? ''}`)) return true;
  if (EMPTY_PAGE_LAYOUT_EVENTS.has(`${category}|${action}|${type ?? ''}`)) return true;
  if (ISOMETRIC_VIEW.has(`${category}|${action}|${type ?? ''}`)) return true;
  if (
    (category === 'Help' || (category === 'UI' && action === 'Opened')) &&
    type === ISOMETRIC_HELP_ID
  )
    return true;
  if (category === 'Document' && action === 'Reverted') return true;
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
