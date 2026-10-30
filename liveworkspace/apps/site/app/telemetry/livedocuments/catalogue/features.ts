// Which features carry the work: layers, the palette and canvas modes, look and feel, search, dialogs, chrome, notes, actions, organisation (docs/specs/017-telemetry/telemetry.md).
// Part of the metric catalogue: import from ../metric-catalogue.

import { isHelpArticleType, isSettingsCategory } from '../../_shared/opened-types';
import { SELECTION_MODES } from '../palette-types';
import { NON_PATTERN_CANVAS_TYPES } from '../../_shared/look-feel-types';
import { isNonThemePick } from '../palette-types';
import type { Metric, MetricStack } from '../../_shared/metric-series';
import { chart } from '../../_shared/catalogue-helpers';
import { elementTourTokens } from '../element-tour-kinds';

export const LAYERS_RENAMED = chart(
  'Layer',
  'Renamed',
  'Layers Renamed',
  'A layer renamed by hand, or named automatically from the first labelled element put on it (smart naming).',
);

export const LAYERS_SELECTED = chart(
  'Layer',
  'Selected',
  'Layers Selected',
  'A layer made the active one.',
);

export const LAYERS_REORDERED = chart(
  'Layer',
  'Reordered',
  'Layers Reordered',
  'Layers dragged into a new order.',
);

export const FOLDERS_RENAMED = chart(
  'Folder',
  'Renamed',
  'Tab Folders Renamed',
  'A folder of tab pills renamed inside one document.',
);

export const NOTES_DELETED = chart(
  'Note',
  'Deleted',
  'Notes Deleted',
  'A note cleared from an element.',
  { rising: 'neutral' },
);

export const ACTIONS_EDITED = chart(
  'Action',
  'Changed',
  'Actions Edited',
  'An assigned action edited or reassigned.',
);

export const ACTIONS_OPENED = chart(
  'Action',
  'Opened',
  'Actions Opened',
  'An element’s actions opened.',
);

export const ACTIONS_DELETED = chart(
  'Action',
  'Deleted',
  'Actions Deleted',
  'An assigned action removed.',
  { rising: 'neutral' },
);

// The long tail, found by metric-emitters.test's every-event check.
export const ACTIONS_MOVED_TO_TEAM = chart(
  'Action',
  'Moved',
  'Actions Moved to a Team',
  'An action’s document moved into a team so the assignee can reach it.',
);

export const ACTIONS_REOPENED = chart(
  'Action',
  'Unresolved',
  'Actions Reopened',
  'A completed action marked not done again.',
  { rising: 'neutral' },
);

export const LAYER_OPACITY = chart(
  'Layer',
  'Changed',
  'Layer Opacity',
  'A layer’s opacity changed.',
);

export const LAYERS_CLEARED = chart(
  'Layer',
  'Cleared',
  'Layers Cleared',
  'A layer emptied but kept.',
  { rising: 'neutral' },
);

export const LAYERS_MERGED = chart(
  'Layer',
  'Removed',
  'Layers Merged',
  'A layer merged into the one above or below.',
  { types: ['MergedDown', 'MergedUp'] },
);

export const NOTES_EDITED = chart('Note', 'Changed', 'Notes Edited', 'A written note changed.');

export const NOTE_FORMATTING = chart(
  'Note',
  'Used',
  'Note Formatting',
  'Rich-text formatting used inside a note.',
);

export const TABS_UNFILED = chart(
  'Tab',
  'Removed',
  'Tabs Unfiled',
  'A tab taken out of a tab folder.',
  { types: ['Folder'], rising: 'neutral' },
);

export const MODE_OPTIONS = chart(
  'UI',
  'Changed',
  'Mode Options',
  'Settings inside a canvas mode: laser, spotlight and format painter options.',
  { typeIn: (t) => /^(Laser|Spotlight|Format)/.test(t ?? '') },
);

// Pages mode's A4 page turned portrait or landscape (docs/specs/007-editor/pages-mode.md).
export const PAGE_ORIENTATION = chart(
  'Tab',
  'Changed',
  'Page Orientations Set',
  "A Pages tab's A4 page turned to portrait or landscape, from the page's settings.",
  { types: ['PagePortrait', 'PageLandscape'] },
);

// Pages added after the last one, or deleted (docs/specs/007-editor/pages-mode.md "The pages").
export const PAGES = chart(
  'Tab',
  'Changed',
  'Pages Added and Deleted',
  'A page added to a Pages tab from the plus after its last page (an infographic page, a new article, a slide or a flashcard), or deleted from its settings.',
  {
    types: [
      'PageAdded',
      'ArticleAdded',
      'SlidePageAdded',
      'FlashcardAdded',
      'PageRemoved',
      'PageKindInfographic',
      'PageKindArticle',
      'PageKindSlide',
      'PageKindFlashcard',
      'PageAddedLikeLast',
    ],
  },
);

// A page's own settings (docs/specs/007-editor/pages-mode.md).
export const PAGE_SETUP = chart(
  'Tab',
  'Changed',
  'Pages Set Up',
  "A page's size, name, background or pattern changed from its panel (or a background given to every page of its kind, or painted from another page), or a page locked or unlocked.",
  {
    types: [
      'PageSize',
      'PageRenamed',
      'PageBackground',
      'PageBackgroundImage',
      'PageBackgroundAnimated',
      'PageBackgroundAnimatedSpeed',
      'PageBackgroundAppliedToAll',
      'PageBackgroundPainted',
      'PagePattern',
      'PageLocked',
      'PageUnlocked',
    ],
  },
);

// Contents (docs/specs/007-editor/pages-mode.md "Contents"): a press on a page in the list,
// going there, or a page dragged to a new place in it.
export const PAGE_CONTENTS_JUMPS = chart(
  'UI',
  'Used',
  'Contents Jumps and Reorders',
  "A page pressed in Pages mode's Contents list (the canvas gliding to it), or dragged to a new place there.",
  { types: ['PageContentsJump', 'PageContentsReorder'], rising: 'neutral' },
);

// The view rests on a page (docs/specs/007-editor/pages-mode.md "Getting around the pages"): a
// short pan or a flick from a page seen whole turning to its neighbour.
export const PAGE_SWIPES = chart(
  'UI',
  'Used',
  'Page Swipes',
  'A short pan or flick in Pages mode that turned the view to the next or previous page.',
  { types: ['PageSwipe'], rising: 'neutral' },
);

// A flashcard turned over to its other side (docs/specs/007-editor/flashcards.md).
export const FLASHCARD_FLIPS = chart(
  'UI',
  'Used',
  'Flashcard Flips',
  'A flashcard turned over to show its other side.',
  { types: ['FlashcardFlip'], rising: 'neutral' },
);

// Tab windows (docs/specs/009-elements/tab-window.md): a window's tab chosen, and the tab opened from it.
export const TAB_WINDOW_USE = chart(
  'UI',
  'Used',
  'Tab Windows Opened',
  'A tab opened from a Tab Window showing it, on a slide or page.',
  { types: ['TabWindowOpen'], rising: 'neutral' },
);

// Building pages: a layout placed, a page duplicated or moved.
export const PAGE_BUILDING = chart(
  'Tab',
  'Changed',
  'Pages Built',
  'A layout put onto a page, a page duplicated, moved or split (a flashcard too long for its card included), or a board put onto a page.',
  {
    types: [
      'PageLayout',
      'PageLayoutSurprise',
      'PageDuplicated',
      'PageMoved',
      'PagesLaidOut',
      'PageFitToContent',
      'FlashcardSplit',
    ],
  },
);

// An empty infographic page's in-page layout card hidden (docs/specs/007-editor/pages-mode.md
// "Layouts"): set beside Page Layout to see whether the card helps or gets in the way.
export const EMPTY_PAGE_LAYOUTS_HIDDEN = chart(
  'UI',
  'Closed',
  'Empty Page Layouts Hidden',
  'Someone hid the Start From a Layout card an empty page shows inside itself.',
  { types: ['EmptyPageLayouts'] },
);

// Writing articles (docs/specs/007-editor/article-pages.md "Telemetry").
export const ARTICLE_INSERTS = chart(
  'Element',
  'Added',
  'Article Inserts',
  'Something put into the writing of an article: an image, table, chart or drawing at the caret, an object or drawing taken in from the palette, or a divider, page break, quote or code block.',
  {
    types: [
      'ArticleImage',
      'ArticleTable',
      'ArticleChart',
      'ArticleCallout',
      'ArticleSticky',
      'ArticleDrawing',
      'ArticleObject',
      'ArticleDivider',
      'ArticlePageBreak',
      'ArticleQuote',
      'ArticleCode',
      'ArticleComment',
      'ArticleAction',
    ],
  },
);

export const ARTICLE_FORMATTING = chart(
  'Element',
  'Changed',
  'Article Formatting',
  "The page toolbar used on an article's writing (a format, a text style or list, a link) and a zone in the writing wrapped, placed or deleted.",
  {
    types: [
      'ArticleFormat',
      'ArticleBlockStyle',
      'ArticleLink',
      'ArticlePaste',
      'ArticleZoneWrap',
      'ArticleZoneResized',
      'ArticleZoneMoved',
      'ArticleZoneFloat',
      'ArticleZoneRemoved',
    ],
  },
);

export const ARTICLE_LOOKS = chart(
  'Tab',
  'Changed',
  'Article Looks',
  "An article's look chosen in its Style tab, or one of its style fields changed.",
  {
    types: [
      'ArticleLookClean',
      'ArticleLookClassic',
      'ArticleLookReport',
      'ArticleLookNotebook',
      'ArticleLookBold',
      'ArticleStyle',
    ],
  },
);

// Pages (docs/specs/007-editor/pages-mode.md): pages made and set up, and articles.
export const PAGE_WORK: MetricStack = {
  stack: true,
  title: 'Pages',
  blurb: 'Pages added and set up, and articles written and styled.',
  members: [
    PAGE_ORIENTATION,
    PAGES,
    PAGE_SETUP,
    PAGE_BUILDING,
    PAGE_CONTENTS_JUMPS,
    PAGE_SWIPES,
    FLASHCARD_FLIPS,
    TAB_WINDOW_USE,
    EMPTY_PAGE_LAYOUTS_HIDDEN,
    ARTICLE_INSERTS,
    ARTICLE_FORMATTING,
    ARTICLE_LOOKS,
  ],
  headline: PAGES,
};

// Layers (docs/specs/006-document/layers.md): made, used, and looked at.
export const LAYERS_CREATED: Metric = {
  category: 'Layer',
  action: 'Added',
  type: null,
  title: 'Layers Created',
  blurb: 'A new layer on a tab.',
};

export const LAYER_TOGGLES: Metric = {
  category: 'Layer',
  action: 'Toggled',
  allTypes: true,
  title: 'Visibility & Lock Toggles',
  blurb:
    'The eye and the padlock, across hide / show / lock / unlock. The gesture layers are actually for.',
};

export const LAYER_MOVES: Metric = {
  category: 'Layer',
  action: 'Moved',
  type: null,
  title: 'Selections Moved to a Layer',
  blurb: 'Elements sent to another layer: layers being used to organise, not just to hide.',
};

export const LAYERS_DELETED: Metric = {
  rising: 'neutral',
  category: 'Layer',
  action: 'Deleted',
  type: null,
  title: 'Layers Deleted',
};

export const LAYERS_PANEL_OPENED: Metric = {
  category: 'Layer',
  action: 'Opened',
  allTypes: true,
  title: 'Layers Panel Opened',
  blurb: 'Read against the layer counts: a panel opened far more often than used is a hint.',
};

export const LAYERS_FEATURE: MetricStack = {
  stack: true,
  title: 'Layers Feature',
  blurb: 'Every layer interaction: layers made, toggled, filled, deleted, and the panel opened.',
  members: [
    LAYERS_CREATED,
    LAYER_TOGGLES,
    LAYER_MOVES,
    LAYERS_DELETED,
    LAYERS_PANEL_OPENED,
    LAYERS_RENAMED,
    LAYERS_SELECTED,
    LAYERS_REORDERED,
    LAYER_OPACITY,
    LAYERS_MERGED,
    LAYERS_CLEARED,
  ],
};

// ---- Editing tab -------------------------------------------------------------
// Tools that organise the work rather than draw it. Tab folders (docs/specs/006-document/tab-folders.md) are
// typed rather than bare because the bare Tab/Folder events belong to
// different subjects: see the type note in docs/specs/017-telemetry/telemetry.md's Folder entry.

export const NOTES_ADDED: Metric = {
  category: 'Note',
  action: 'Added',
  type: null,
  title: 'Notes Added',
  blurb: "An element's note went from empty to written.",
};

export const NOTES_OPENED: Metric = {
  category: 'Note',
  action: 'Opened',
  type: null,
  title: 'Notes Opened',
  blurb: 'The note popover was opened, to read as well as to write.',
};

export const ACTIONS_ASSIGNED: Metric = {
  category: 'Action',
  action: 'Created',
  allTypes: true,
  title: 'Actions Assigned',
  blurb: 'Work on an element assigned to a teammate, with or without the email notification.',
};

export const ACTIONS_EMAILED: Metric = {
  category: 'Action',
  action: 'Created',
  type: 'EmailOn',
  title: 'Actions Emailed',
  blurb:
    'Actions assigned with the notify-by-email box ticked. Part of Actions Assigned. Counts the box, not a sent email: sends are Action Notifications in the Emails Sent stack on the Dashboard.',
};

export const ACTIONS_COMPLETED: Metric = {
  category: 'Action',
  action: 'Resolved',
  // Won't Do closes an action without it being done: its own card, below.
  typeIn: (type) => type !== 'WontDo',
  title: 'Actions Completed',
  blurb: 'Read against actions assigned: the follow-through rate on the feature.',
};

export const ACTIONS_WONT_DO: Metric = {
  category: 'Action',
  action: 'Resolved',
  type: 'WontDo',
  title: 'Actions Closed as Won’t Do',
  blurb:
    'Actions someone decided against: closed without being done, from the canvas or the Actions board.',
};

// Folders of documents in the Explorer, yours or a team's.
export const FOLDERS_CREATED: Metric = {
  category: 'Folder',
  action: 'Created',
  typeIn: (type) => type !== 'Tab',
  title: 'Folders Created',
  blurb: 'Folders of documents, in your own Explorer or a team library.',
};

export const FOLDERS_RE_PARENTED: Metric = {
  category: 'Folder',
  action: 'Moved',
  allTypes: true,
  title: 'Folders Re-parented',
  blurb: 'A folder nested under another, or promoted back to the root.',
};

export const FOLDERS_DELETED = chart(
  'Folder',
  'Deleted',
  'Folders Deleted',
  'A folder removed, in your Explorer or a team library.',
  { rising: 'neutral' },
);

// Default folders (docs/specs/013-workspace/default-folders.md "Telemetry"): by what the default is for, a kind of
// document or one template (Kind, Template).
export const DEFAULT_FOLDERS_SET = chart(
  'Folder',
  'Changed',
  'Default Folders Set',
  'A folder chosen as where new documents of one kind or template land: from a folder menu or Settings.',
  { rising: 'good' },
);

export const DEFAULT_FOLDERS_CLEARED = chart(
  'Folder',
  'Cleared',
  'Default Folders Cleared',
  'A default folder cleared, so new documents of that kind land in My Work again.',
  { rising: 'neutral' },
);

export const TAB_FOLDERS_CREATED: Metric = {
  category: 'Folder',
  action: 'Created',
  type: 'Tab',
  title: 'Tab Folders Created',
  blurb: 'A collapsible folder of tab pills created inside one document.',
};

export const TABS_FILED: Metric = {
  category: 'Tab',
  action: 'Moved',
  type: 'Folder',
  title: 'Tabs Filed',
  blurb:
    'A tab filed into a tab folder, by the ellipsis menu or by a drag (both report identically).',
};

export const NOTES: MetricStack = {
  stack: true,
  title: 'Notes',
  blurb: 'Notes written on elements, and opened to read or edit.',
  members: [NOTES_ADDED, NOTES_OPENED, NOTES_DELETED, NOTES_EDITED, NOTE_FORMATTING],
  headline: NOTES_ADDED,
};

export const ASSIGNED_ACTIONS: MetricStack = {
  stack: true,
  title: 'Assigned Actions',
  blurb: 'Work on an element assigned to a teammate, emailed about, and completed.',
  members: [
    ACTIONS_ASSIGNED,
    ACTIONS_EMAILED,
    ACTIONS_COMPLETED,
    ACTIONS_WONT_DO,
    ACTIONS_EDITED,
    ACTIONS_OPENED,
    ACTIONS_DELETED,
    ACTIONS_REOPENED,
    ACTIONS_MOVED_TO_TEAM,
  ],
  headline: ACTIONS_ASSIGNED,
};

// The shared Explorer's filter lens (docs/specs/013-workspace/explorer-filters.md "Telemetry"), through ExplorerHost's
// onLensSelected prop: Explorer·Selected·<Facet>, one per facet that gained a value, by kind (never what was picked).
export const EXPLORER_FILTERS_PICKED = chart(
  'Explorer',
  'Selected',
  'Explorer Filters Used',
  'A filter reached for on an Explorer list, by kind: words, Opens in, Template, Made by AI, Edited, People or Space, from a chip, a suggestion or a typed token.',
  { rising: 'good' },
);

export const ORGANISATION: MetricStack = {
  stack: true,
  title: 'Organisation',
  blurb:
    'Folders made, nested and deleted in the Explorer, default folders, tab folders inside a document with tabs filed into and out of them, and the Explorer’s filters.',
  members: [
    FOLDERS_CREATED,
    FOLDERS_RE_PARENTED,
    FOLDERS_DELETED,
    DEFAULT_FOLDERS_SET,
    DEFAULT_FOLDERS_CLEARED,
    TAB_FOLDERS_CREATED,
    TABS_FILED,
    FOLDERS_RENAMED,
    TABS_UNFILED,
    EXPLORER_FILTERS_PICKED,
  ],
};

// The editor's search panel.
export const SEARCH_OPENED = chart(
  'Search',
  'Opened',
  'Search Opened',
  'The editor search panel opened.',
);

export const SEARCH_QUERIES = chart(
  'Search',
  'Searched',
  'Searches',
  'A query typed into the panel, once per open.',
);

export const SEARCH_RESULTS_PICKED = chart(
  'Search',
  'Selected',
  'Results Picked',
  'A command, element or help result chosen.',
);

export const EDITOR_SEARCH: MetricStack = {
  stack: true,
  title: 'Editor Search',
  blurb: 'The search panel: opened, searched, and a result picked.',
  members: [SEARCH_OPENED, SEARCH_QUERIES, SEARCH_RESULTS_PICKED],
  headline: SEARCH_OPENED,
};

// The palette beyond adding elements (Palette tab has the rankings).
export const PALETTE_SEARCHES = chart(
  'UI',
  'Searched',
  'Palette Searches',
  'Searches inside the palette, its icons, technology marks and behaviours.',
);

export const PALETTE_GROUPS_OPENED = chart(
  'UI',
  'Opened',
  'Palette Groups Opened',
  'A palette group, toolbar overflow or toolbar search opened.',
  {
    typeIn: (type) =>
      (type ?? '').endsWith('Group') ||
      type === 'ToolbarMore' ||
      type === 'ToolbarExplorer' ||
      type === 'ToolbarSearch' ||
      type === 'ToolbarSearchOtherModes',
  },
);

export const TOOLBAR_CATEGORY = chart(
  'UI',
  'Changed',
  'Toolbar Category',
  'The Toolbar layout switched to another category.',
  { types: ['ToolbarCategory'] },
);

export const PALETTE_USE: MetricStack = {
  stack: true,
  title: 'Palette Use',
  blurb: 'How the palette gets used beyond adding elements: searches, groups, and the toolbar.',
  members: [PALETTE_SEARCHES, PALETTE_GROUPS_OPENED, TOOLBAR_CATEGORY],
  seeAlso: { section: 'palette', label: 'See Each Element in Features › Palette' },
};

// The canvas selection modes, one chart per mode, and the options set inside
// them (Canvas Modes tab has the rankings).
const MODE_TITLES: Record<string, string> = {
  Laser: 'Laser',
  Spotlight: 'Spotlight',
  FormatPainter: 'Format Painter',
};

export const MODE_METRICS: readonly Metric[] = SELECTION_MODES.map((mode) =>
  chart(
    'Canvas',
    'Used',
    MODE_TITLES[mode] ?? mode,
    `The ${(MODE_TITLES[mode] ?? mode).toLowerCase()} mode switched on from the palette.`,
    { types: [mode] },
  ),
);

export const CANVAS_MODES: MetricStack = {
  stack: true,
  title: 'Canvas Modes',
  blurb: 'Ways of working on the canvas picked from the palette, and the options set inside them.',
  members: [...MODE_METRICS, MODE_OPTIONS],
  // Modes switched into; tweaking an option inside one is not another use.
  headline: [...MODE_METRICS],
  seeAlso: { section: 'modes', label: 'See Each Mode in Features › Modes' },
};

// Editor chrome: layout and navigation.
export const CANVAS_ZOOMS = chart(
  'Canvas',
  'Zoomed',
  'Canvas Zooms',
  'Zoomed in or out, to fit, to a preset, or on a double-tapped spot.',
);

export const ZEN_MODE = chart('UI', 'Toggled', 'Zen Mode', 'Zen mode switched on or off.', {
  types: ['ZenModeOn', 'ZenModeOff'],
  rising: 'neutral',
});

export const LANDSCAPE_BARS = chart(
  'UI',
  'Toggled',
  'Landscape Bars',
  'The header and tabs shown or folded from the handle on a phone held sideways.',
  { types: ['LandscapeBarsOn', 'LandscapeBarsOff'], rising: 'neutral' },
);

export const PANELS_DOCKED = chart(
  'UI',
  'Moved',
  'Panels Docked',
  'A panel dragged into a corner dock, or out of one.',
  { types: ['PanelDock'], rising: 'neutral' },
);

export const EXPLORER_VIEW = chart(
  'UI',
  'Toggled',
  'Explorer View',
  'The Explorer switched between cards and a list.',
  { typeIn: (type) => (type ?? '').startsWith('ExplorerView'), rising: 'neutral' },
);

export const EDITOR_CHROME: MetricStack = {
  stack: true,
  title: 'Editor Chrome',
  blurb:
    'Getting around and arranging the workspace: zoom, zen mode, the bars on a phone held sideways, panel layout, the Explorer view.',
  members: [CANVAS_ZOOMS, ZEN_MODE, LANDSCAPE_BARS, PANELS_DOCKED, EXPLORER_VIEW],
};

// Dialogs and panels opened (UI·Opened), split by what was opened.
const OPENED_HOMES: ((type: string | null) => boolean)[] = [];

const opened = (title: string, blurb: string, typeIn: (type: string | null) => boolean): Metric => {
  OPENED_HOMES.push(typeIn);
  return chart('UI', 'Opened', title, blurb, { typeIn });
};

export const SETTINGS_OPENED = opened(
  'Settings Opened',
  'The Settings dialog opened.',
  (t) => t === 'Settings',
);

export const SETTINGS_CATEGORIES_VISITED = opened(
  'Settings Categories Visited',
  'A category picked inside the open Settings dialog: Appearance, Editor, Account and the rest.',
  isSettingsCategory,
);

export const SHARE_OPENED = opened(
  'Share Opened',
  'The Share dialog or the collaborators list opened.',
  (t) => t === 'Share' || t === 'Collaborators',
);

export const PICKERS_OPENED = opened(
  'Theme & Canvas Pickers',
  'The theme picker or the canvas style panel opened.',
  (t) => t === 'ThemePicker' || t === 'CanvasStyle',
);

export const HELP_FROM_EDITOR = opened(
  'Help from the Editor',
  'A help article opened from inside the editor.',
  isHelpArticleType,
);

export const SHORTCUTS_OPENED = opened(
  'Shortcuts Opened',
  'The keyboard shortcuts list opened.',
  (t) => t === 'Shortcuts',
);

// The Pages tour's offer (docs/specs/007-editor/pages-tour.md); charted in its funnel on the Visitors tab.
export const PAGES_TOUR_OFFERED = opened(
  'Pages Tour Offered',
  'The Pages tour offered, the first time someone works in Pages mode. Since 25 October 2026, the Start Tour button in the footer showing it.',
  (t) => t === 'PagesTourOffer',
);

// The element tours' offers (docs/specs/007-editor/element-tours.md), any `<Kind>TourOffer`; charted in their funnel on
// the Visitors tab, which names the kinds.
export const ELEMENT_TOURS_OFFERED = opened(
  'Element Tours Offered',
  'An element tour offered beside a selected element, once per kind per visit. Since 25 October 2026, the Start Tour button in the footer showing it.',
  (t) => elementTourTokens('Offer').includes(t ?? ''),
);

// The power user mode offer (docs/specs/007-editor/power-user-mode.md); charted in its funnel on
// the Visitors tab.
export const POWER_USER_OFFERED = opened(
  'Power User Mode Offered',
  'The offer shown, after 20 editing days or 50 shortcuts on one device.',
  (t) => t === 'PowerUserOffer',
);

// The new version prompt (docs/specs/016-platform/new-version-prompt.md); charted with its reloads
// on the Visitors tab.
export const NEW_VERSION_OFFERED = opened(
  'New Version Offered',
  'An open editor heard the server serves a newer document format, and offered a reload.',
  (t) => t === 'NewVersionPrompt',
);

export const SLIDE_DECK_OPENED = opened(
  'Slide Deck Opened',
  'The Slide Deck panel or presentation settings opened.',
  (t) => t === 'SlideDeck' || t === 'PresentationSettings',
);

export const EXPLORER_REASONS_OPENED = opened(
  'Explorer Banner: Learn More',
  'The Explorer\u2019s sign-in banner: Learn more opened the reasons to sign in.',
  (t) => t === 'SignInReasonsExplorer',
);

export const EDITOR_REASONS_OPENED = opened(
  'Editor Banner: Learn More',
  'The editor\u2019s sign-in banner (shown after about five minutes of drawing as a guest): Learn more opened the reasons.',
  (t) => t === 'SignInReasonsEditor',
);

export const ACTION_SIGN_IN_NUDGE = opened(
  'Assign Action Nudge',
  'A guest opened Assign Action and was asked to sign in, since actions need an account.',
  (t) => t === 'ActionSignInNudge',
);

// The move prompt after signing in (docs/specs/014-identity/auth-and-guest-access.md "Moving documents in This Browser
// after signing in"); charted with Offline Mode on the Dashboard.
export const LOCAL_MOVE_OFFERED = opened(
  'Move Prompt Shown',
  'Someone signed in with documents kept only in this browser and was offered to move them to the account.',
  (t) => t === 'LocalMovePrompt',
);

OPENED_HOMES.push(PALETTE_GROUPS_OPENED.typeIn!);

export const OTHER_OPENED = chart(
  'UI',
  'Opened',
  'Other Panels Opened',
  'Any other dialog or panel opened.',
  { typeIn: (t) => !OPENED_HOMES.some((home) => home(t)) },
);

export const PANELS_OPENED: MetricStack = {
  stack: true,
  title: 'Dialogs & Panels',
  blurb: 'Which dialogs and panels people open, from Settings and Share to help articles.',
  members: [
    SETTINGS_OPENED,
    SETTINGS_CATEGORIES_VISITED,
    SHARE_OPENED,
    PICKERS_OPENED,
    HELP_FROM_EDITOR,
    SHORTCUTS_OPENED,
    OTHER_OPENED,
  ],
  seeAlso: { section: 'editing', label: 'See Each Dialog in Features › Editing' },
};

// Look and feel (Look & Feel tab has the rankings).
export const TEMPLATES_USED = chart(
  'Template',
  'Used',
  'Templates Used',
  'A template picked to start a document or seed a tab.',
);

export const THEMES_CHOSEN = chart(
  'Theme',
  'Changed',
  'Themes Chosen',
  'A built-in theme picked, at creation or later.',
  { typeIn: (t) => !isNonThemePick(t) },
);

export const CANVAS_STYLES_PICKED = chart(
  'Canvas',
  'Changed',
  'Canvas Styles Picked',
  'A background pattern picked for the canvas.',
  { typeIn: (t) => !NON_PATTERN_CANVAS_TYPES.includes(t ?? '') },
);

export const CANVAS_CONTROLS_TWEAKED = chart(
  'Canvas',
  'Changed',
  'Canvas Controls Tweaked',
  'The canvas colour, opacity, pattern colour, scale or animation speed changed.',
  { types: NON_PATTERN_CANVAS_TYPES, rising: 'neutral' },
);

// The quick style panel's own palette (docs/specs/008-canvas/quick-style-panel.md): a swatch replaced with
// a colour of your own, or put back to the theme's.
export const CUSTOM_SWATCHES = chart(
  'UI',
  'Changed',
  'Custom Swatches',
  'A quick style panel swatch replaced with a colour of your own, or put back to the theme colour.',
  { types: ['QuickSwatchCustom', 'QuickSwatchReset'], rising: 'neutral' },
);

// The Tab Style popover's Finish filter beside its Looks carousel (docs/specs/011-theme/
// canvas-and-theme-dialog.md).
export const LOOKS_FILTERED = chart(
  'UI',
  'Changed',
  'Looks Filtered',
  "The Tab Style popover's Looks narrowed to one finish with its Finish filter, or switched to the seasonal looks with its Seasonal toggle.",
  { types: ['LooksFinishFilter', 'LooksSeasonal'], rising: 'neutral' },
);

export const LOOK_AND_FEEL: MetricStack = {
  stack: true,
  title: 'Look & Feel',
  blurb:
    'The visual presets people reach for: templates, themes and canvas styles. Headed by themes and canvas styles picked: a template also applies its theme, so adding templates would count that pick twice.',
  members: [
    TEMPLATES_USED,
    THEMES_CHOSEN,
    CANVAS_STYLES_PICKED,
    CANVAS_CONTROLS_TWEAKED,
    CUSTOM_SWATCHES,
    LOOKS_FILTERED,
  ],
  headline: [THEMES_CHOSEN, CANVAS_STYLES_PICKED],
  seeAlso: { section: 'lookfeel', label: 'See Each Preset in Features › Look & Feel' },
};
