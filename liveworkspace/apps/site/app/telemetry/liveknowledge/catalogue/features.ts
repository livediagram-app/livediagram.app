// Which features carry the work: writing the pages, the palette and the format painter, look and feel, search, dialogs, chrome, notes, actions, organisation (docs/specs/017-telemetry/telemetry.md).
// Part of the metric catalogue: import from ../metric-catalogue.

import { isHelpArticleType, isSettingsCategory } from '../../_shared/opened-types';
import { NON_PATTERN_CANVAS_TYPES } from '../../_shared/look-feel-types';
import { isNonThemePick } from '../palette-types';
import type { Metric, MetricStack } from '../../_shared/metric-series';
import { chart } from '../../_shared/catalogue-helpers';
import { OPENED_HOMES, openedChart } from './opened';

// The one layer event still sent since the Layers panel went (2026-11-08, docs/specs/006-document/layers.md
// "Retired: the Layers panel"): a layer named from the first labelled element put on it (smart naming).
export const LAYERS_NAMED = chart(
  'Layer',
  'Renamed',
  'Layers Named',
  'A layer named automatically from the first labelled element put on it (smart naming).',
  { types: ['Adopted'] },
);

export const FOLDERS_RENAMED = chart(
  'Folder',
  'Renamed',
  'Tab Folders Renamed',
  'A folder of tab pills renamed inside one document.',
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

export const TABS_UNFILED = chart(
  'Tab',
  'Removed',
  'Tabs Unfiled',
  'A tab taken out of a tab folder.',
  { types: ['Folder'], rising: 'neutral' },
);

// The format painter (docs/specs/030-knowledgebase/page-surface.md "No Selection mode": the one canvas tool kept, every
// other reads as Select), and the options set inside it.
export const FORMAT_PAINTER_USED = chart(
  'Canvas',
  'Used',
  'Format Painter',
  'The format painter switched on, to copy one element\u2019s style onto others.',
  { types: ['FormatPainter'] },
);

export const FORMAT_PAINTER_OPTIONS = chart(
  'UI',
  'Changed',
  'Format Painter Options',
  'What the format painter copies, and whether it stays on for more than one paste.',
  { typeIn: (t) => /^Format/.test(t ?? ''), rising: 'neutral' },
);

// The Word Count line picked to select the article's next long sentence (docs/specs/007-editor/article-pages.md
// "Word Count").
export const LONG_SENTENCES = chart(
  'UI',
  'Used',
  'Long Sentences Selected',
  "The Word Count line in an article's More Formatting picked to select the next sentence over 30 words, to split it.",
  { types: ['LongSentenceSelected'], rising: 'neutral' },
);

// Print (docs/specs/020-import-export/print.md): Export's Print, the scope in the type.
export const PRINTS = chart(
  'UI',
  'Used',
  'Prints',
  'Pages printed from Export: the page in view, or the whole document.',
  { types: ['PrintPage', 'PrintDocument'], rising: 'good' },
);

// Writing articles (docs/specs/007-editor/article-pages.md "Telemetry").
export const ARTICLE_INSERTS = chart(
  'Element',
  'Added',
  'Article Inserts',
  'Something put into the writing of an article: an image, table, chart or drawing at the caret, an object or drawing taken in from the palette, or a divider, page break, quote, code block, table of contents, footnote or embed.',
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
      'ArticleContents',
      'ArticleFootnote',
      'ArticleComment',
      'ArticleAction',
      'ArticleEmbed',
    ],
  },
);

export const ARTICLE_FORMATTING = chart(
  'Element',
  'Changed',
  'Article Formatting',
  "The page toolbar used on an article's writing (a format, a text style or list, a link), a table in the writing reshaped or pasted, and a zone in the writing wrapped, placed or deleted.",
  {
    types: [
      'ArticleFormat',
      'ArticleBlockStyle',
      'ArticleLink',
      'ArticlePaste',
      'ArticleTableShape',
      'ArticleTablePaste',
      'ArticleZoneWrap',
      'ArticleZoneResized',
      'ArticleZoneMoved',
      'ArticleZoneFloat',
      'ArticleZoneRemoved',
    ],
  },
);

// Writing the pages (docs/specs/030-knowledgebase/knowledgebases-and-pages.md "The continuous page"): every page is
// one article, so this is what goes into the writing, how it is formatted and styled, and printing it.
export const PAGE_WORK: MetricStack = {
  stack: true,
  title: 'Writing',
  blurb:
    'What goes into the pages and how it is shaped: inserts, formatting, long sentences split, and prints. Headed by inserts and formatting.',
  members: [ARTICLE_INSERTS, ARTICLE_FORMATTING, LONG_SENTENCES, PRINTS],
  headline: [ARTICLE_INSERTS, ARTICLE_FORMATTING],
};

// ---- Editing tab -------------------------------------------------------------
// Tools that organise the work rather than draw it. Tab folders (docs/specs/006-document/tab-folders.md) are
// typed rather than bare because the bare Tab/Folder events belong to
// different subjects: see the type note in docs/specs/017-telemetry/telemetry.md's Folder entry.

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
    'Folders made, nested and deleted in the Explorer, default folders, tab folders inside a document with tabs filed into and out of them, layers named from their labels, and the Explorer’s filters.',
  members: [
    FOLDERS_CREATED,
    FOLDERS_RE_PARENTED,
    FOLDERS_DELETED,
    DEFAULT_FOLDERS_SET,
    DEFAULT_FOLDERS_CLEARED,
    TAB_FOLDERS_CREATED,
    TABS_FILED,
    FOLDERS_RENAMED,
    LAYERS_NAMED,
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

// Find and Replace on a tab (docs/specs/007-editor/find-and-replace.md "Telemetry"): the bar opened, and a match
// replaced or every match at once. The queries and the words are never sent.
export const FIND_BAR_OPENED = chart(
  'UI',
  'Opened',
  'Find Opened',
  'The Find bar opened on a tab, from Cmd/Ctrl+F or Cmd/Ctrl+Shift+H.',
  { typeIn: (t) => t === 'FindBar' },
);

export const FIND_REPLACES = chart(
  'UI',
  'Used',
  'Replaces',
  'One match replaced, or every match at once with Replace All.',
  { types: ['FindReplace', 'FindReplaceAll'] },
);

export const FIND_AND_REPLACE: MetricStack = {
  stack: true,
  title: 'Find and Replace',
  blurb: 'The Find bar opened on a tab, and its matches replaced one at a time or all at once.',
  members: [FIND_BAR_OPENED, FIND_REPLACES],
  headline: FIND_BAR_OPENED,
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
  seeAlso: { tab: 'palette', label: 'See Each Element on the Palette Tab' },
};

export const FORMAT_PAINTER: MetricStack = {
  stack: true,
  title: 'Format Painter',
  blurb: 'The format painter switched on, and the options set inside it.',
  members: [FORMAT_PAINTER_USED, FORMAT_PAINTER_OPTIONS],
  // Switched on; tweaking an option inside it is not another use.
  headline: FORMAT_PAINTER_USED,
};

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
    'Arranging the workspace: zen mode, the bars on a phone held sideways, panel layout, the Explorer view.',
  members: [ZEN_MODE, LANDSCAPE_BARS, PANELS_DOCKED, EXPLORER_VIEW],
};

// Dialogs and panels opened (UI·Opened), split by what was opened (./opened.ts keeps the homes).

export const SETTINGS_OPENED = openedChart(
  'Settings Opened',
  'The Settings dialog opened.',
  (t) => t === 'Settings',
);

export const SETTINGS_CATEGORIES_VISITED = openedChart(
  'Settings Categories Visited',
  'A category picked inside the open Settings dialog: Appearance, Editor, Account and the rest.',
  isSettingsCategory,
);

export const SHARE_OPENED = openedChart(
  'Share Opened',
  'The Share dialog or the collaborators list opened.',
  (t) => t === 'Share' || t === 'Collaborators',
);

export const PICKERS_OPENED = openedChart(
  'Theme & Canvas Pickers',
  'The theme picker or the canvas style panel opened.',
  (t) => t === 'ThemePicker' || t === 'CanvasStyle',
);

export const HELP_FROM_EDITOR = openedChart(
  'Help from the Editor',
  'A help article opened from inside the editor.',
  isHelpArticleType,
);

export const SHORTCUTS_OPENED = openedChart(
  'Shortcuts Opened',
  'The keyboard shortcuts list opened.',
  (t) => t === 'Shortcuts',
);

// The Get Started button drawn (docs/specs/007-editor/knowledge-tours.md "Telemetry"), once a visit while a tour is
// untaken; charted in the Get Started tours' funnel on the Visitors tab.
export const KNOWLEDGE_TOURS_OFFERED = openedChart(
  'Get Started Offered',
  'The Get Started button drawn in the footer while a tour is untaken, once per visit.',
  (t) => t === 'KnowledgeToursOffer',
);

export const KNOWLEDGE_TOURS_LISTED = openedChart(
  'Get Started Lists Opened',
  'The Get Started button pressed, opening the list of tours.',
  (t) => t === 'KnowledgeTours',
);

// The new version prompt (docs/specs/016-platform/new-version-prompt.md); charted with its reloads
// on the Visitors tab.
export const NEW_VERSION_OFFERED = openedChart(
  'New Version Offered',
  'An open editor heard the server serves a newer document format, and offered a reload.',
  (t) => t === 'NewVersionPrompt',
);

export const ACTION_SIGN_IN_NUDGE = openedChart(
  'Assign Action Nudge',
  'A guest opened Assign Action and was asked to sign in, since actions need an account.',
  (t) => t === 'ActionSignInNudge',
);

// The move prompt after signing in (docs/specs/014-identity/auth-and-guest-access.md "Moving documents kept Offline
// after signing in"); charted with Offline Mode on the Dashboard.
export const LOCAL_MOVE_OFFERED = openedChart(
  'Move Prompt Shown',
  'Someone signed in with documents kept only in this browser and was offered to move them to the account.',
  (t) => t === 'LocalMovePrompt',
);

OPENED_HOMES.push(PALETTE_GROUPS_OPENED.typeIn!, FIND_BAR_OPENED.typeIn!);

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
  seeAlso: { tab: 'editing', label: 'See Each Dialog on the Editing Tab' },
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

// A template's example content cleared or kept (docs/specs/006-document/template-examples.md, Work Tracker 1181):
// how often people start a template fresh rather than over its examples.
export const TEMPLATE_EXAMPLES = chart(
  'Template',
  'Changed',
  'Template Examples',
  "A template's example content cleared (Clear Example Content) or kept as the person's own (Keep It).",
  { types: ['ExampleCleared', 'ExampleKept'], rising: 'neutral' },
);

export const LOOK_AND_FEEL: MetricStack = {
  stack: true,
  title: 'Look & Feel',
  blurb:
    'The visual presets people reach for: templates, themes and canvas styles. Headed by themes and canvas styles picked: a template also applies its theme, so adding templates would count that pick twice.',
  members: [
    TEMPLATES_USED,
    TEMPLATE_EXAMPLES,
    THEMES_CHOSEN,
    CANVAS_STYLES_PICKED,
    CANVAS_CONTROLS_TWEAKED,
    CUSTOM_SWATCHES,
    LOOKS_FILTERED,
  ],
  headline: [THEMES_CHOSEN, CANVAS_STYLES_PICKED],
  seeAlso: { tab: 'lookfeel', label: 'See Each Preset on the Look & Feel Tab' },
};
