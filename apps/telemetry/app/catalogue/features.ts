// Which features carry the work: AI, layers, the palette and canvas modes, look and feel, search, dialogs, chrome, notes, actions, organisation (spec/22).
// Part of the metric catalogue: import from ../metric-catalogue.

import { isHelpArticleType, isSettingsCategory } from '../opened-types';
import { SELECTION_MODES } from '../palette-types';
import { CUSTOM_THEME_TYPES, NON_PATTERN_CANVAS_TYPES } from '../look-feel-types';
import type { Metric, MetricStack } from '../metric-series';
import { chart } from './helpers';

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

export const FOLDERS_DELETED = chart(
  'Folder',
  'Deleted',
  'Folders Deleted',
  'A folder removed, in your Explorer or a team library.',
  { rising: 'neutral' },
);

export const FOLDERS_RENAMED = chart(
  'Folder',
  'Renamed',
  'Folders Renamed',
  'A folder renamed, in your Explorer or a team library.',
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
  'An action’s diagram moved into a team so the assignee can reach it.',
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
  'Settings inside a canvas mode: eraser, laser, spotlight and format painter options.',
  { typeIn: (t) => /^(Eraser|Laser|Spotlight|Format)/.test(t ?? '') },
);

// AI assistance (Editing tab). Ask and Clean split AI Requests by mode. The
// photo import sends AI·Used too, under Photo* types, and has its own stack.
export const AI_REQUESTS: Metric = {
  category: 'AI',
  action: 'Used',
  typeIn: (type) => type === 'Ask' || type === 'Clean',
  title: 'AI Requests',
  blurb:
    'A completed request in the editor AI panel, across both modes (Ask, Clean). Refusals and failures are not counted.',
};

export const AI_ASK: Metric = {
  category: 'AI',
  action: 'Used',
  type: 'Ask',
  title: 'Ask Requests',
  blurb: 'AI requests in Ask mode: read-only questions about the diagram. Part of AI Requests.',
};

export const AI_CLEAN: Metric = {
  category: 'AI',
  action: 'Used',
  type: 'Clean',
  title: 'Clean Requests',
  blurb:
    'AI requests in Clean mode: tidy-the-tab runs, the one mode that changes the canvas. Part of AI Requests.',
};

export const AI_ASSISTANCE: MetricStack = {
  stack: true,
  title: 'AI Assistance',
  blurb: 'Requests in the editor AI panel, and how they split between Ask and Clean.',
  members: [AI_REQUESTS, AI_ASK, AI_CLEAN],
  headline: AI_REQUESTS,
};

// The photo import (event storming): a wall photo read into sticky notes.
// Each photo analysed sends which detector found its notes (the model, on
// WebGPU or WASM, or the classical fallback and why), and an import the
// author commits sends PhotoNotes. Two units, so the head counts imports.
export const PHOTOS_IMPORTED = chart(
  'AI',
  'Used',
  'Photos Imported',
  'A photo of a sticky-note wall turned into notes on the canvas, once the author confirmed the draft.',
  { types: ['PhotoNotes'] },
);

export const MODEL_DETECTED = chart(
  'AI',
  'Used',
  'Model Detected',
  'A photo whose sticky notes the in-browser AI model found.',
  { typeIn: (type) => (type ?? '').startsWith('PhotoDetectHybrid') },
);

export const FELL_BACK_TO_CLASSICAL = chart(
  'AI',
  'Used',
  'Fell Back to Classical',
  "A photo read by the simpler fallback detector, because the in-browser AI model couldn't run on that device, failed, took too long, or the photo was too flat to read.",
  { typeIn: (type) => (type ?? '').startsWith('PhotoDetectClassical'), rising: 'bad' },
);

export const PHOTO_IMPORT: MetricStack = {
  stack: true,
  title: 'Photo Import',
  blurb:
    'Sticky-note walls photographed into a diagram, and whether the in-browser model or the classical fallback read each photo.',
  members: [PHOTOS_IMPORTED, MODEL_DETECTED, FELL_BACK_TO_CLASSICAL],
  headline: PHOTOS_IMPORTED,
};

// Layers (spec/74): made, used, and looked at.
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
// Tools that organise the work rather than draw it. Tab folders (spec/30) are
// typed rather than bare because the bare Tab/Folder events belong to
// different subjects: see the type note in spec/22's Folder entry.

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
  type: null,
  title: 'Actions Completed',
  blurb: 'Read against actions assigned: the follow-through rate on the feature.',
};

export const FOLDERS_CREATED: Metric = {
  category: 'Folder',
  action: 'Created',
  typeIn: (type) => type !== 'Tab',
  title: 'Folders Created',
  blurb: 'Folders of diagrams, in your own Explorer or a team library.',
};

export const FOLDERS_RE_PARENTED: Metric = {
  category: 'Folder',
  action: 'Moved',
  allTypes: true,
  title: 'Folders Re-parented',
  blurb: 'A folder nested under another, or promoted back to the root.',
};

export const TAB_FOLDERS_CREATED: Metric = {
  category: 'Folder',
  action: 'Created',
  type: 'Tab',
  title: 'Tab Folders Created',
  blurb: 'A collapsible folder of tab pills created inside one diagram.',
};

export const TABS_FILED: Metric = {
  category: 'Tab',
  action: 'Moved',
  type: 'Folder',
  title: 'Tabs Filed',
  blurb:
    'A tab filed into a tab folder, by the ellipsis menu or by a drag (both report identically).',
};

export const DIAGRAMS_FILED: Metric = {
  category: 'Diagram',
  action: 'Moved',
  // The Offline Mode conversions are Diagram·Moved too, charted in their own
  // stack (Taken Offline, Saved to Cloud).
  typeIn: (type) => type !== 'TakenOffline' && type !== 'SavedToCloud',
  title: 'Diagrams Filed',
  blurb: 'A diagram moved into a folder, or back to Unsorted.',
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
    ACTIONS_EDITED,
    ACTIONS_OPENED,
    ACTIONS_DELETED,
    ACTIONS_REOPENED,
    ACTIONS_MOVED_TO_TEAM,
  ],
  headline: ACTIONS_ASSIGNED,
};

export const ORGANISATION: MetricStack = {
  stack: true,
  title: 'Organisation',
  blurb: 'Folders made and nested, tab folders, and tabs and diagrams filed.',
  members: [
    FOLDERS_CREATED,
    FOLDERS_RE_PARENTED,
    TAB_FOLDERS_CREATED,
    TABS_FILED,
    DIAGRAMS_FILED,
    FOLDERS_DELETED,
    FOLDERS_RENAMED,
    TABS_UNFILED,
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
export const PALETTE_FAVOURITES = chart(
  'UI',
  'Added',
  'Palette Favourites',
  'Favourites added, removed, reordered, or the editor opened.',
  {
    actionIn: ['Removed', 'Changed', 'Toggled'],
    typeIn: (type) => (type ?? '').startsWith('PaletteFavourite'),
  },
);

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
  'A palette group or toolbar overflow opened.',
  {
    typeIn: (type) =>
      (type ?? '').endsWith('Group') || type === 'ToolbarMore' || type === 'ToolbarExplorer',
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
  blurb:
    'How the palette gets used beyond adding elements: favourites, searches, groups, and the toolbar.',
  members: [PALETTE_FAVOURITES, PALETTE_SEARCHES, PALETTE_GROUPS_OPENED, TOOLBAR_CATEGORY],
  seeAlso: { view: 'palette', label: 'See Each Element on the Palette Tab' },
};

// The canvas selection modes, one chart per mode, and the options set inside
// them (Canvas Modes tab has the rankings).
const MODE_TITLES: Record<string, string> = {
  Laser: 'Laser',
  Spotlight: 'Spotlight',
  Eraser: 'Eraser',
  Highlighter: 'Highlighter',
  FormatPainter: 'Format Painter',
  Isometric: 'Isometric',
  AvatarMode: 'Avatar Mode',
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
  seeAlso: { view: 'modes', label: 'See Each Mode on the Modes Tab' },
};

// Editor chrome: layout and navigation.
export const CANVAS_ZOOMS = chart(
  'Canvas',
  'Zoomed',
  'Canvas Zooms',
  'Zoomed in or out, to fit, or to a preset.',
);

export const ZEN_MODE = chart('UI', 'Toggled', 'Zen Mode', 'Zen mode switched on or off.', {
  types: ['ZenModeOn', 'ZenModeOff'],
  rising: 'neutral',
});

export const MINIMAL_PANELS = chart(
  'UI',
  'Toggled',
  'Minimal Panels',
  'The panels collapsed to their minimal form, or back.',
  { types: ['MinimalPanelsOn', 'MinimalPanelsOff'], rising: 'neutral' },
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
    'Getting around and arranging the workspace: zoom, zen mode, panel layout, the Explorer view.',
  members: [CANVAS_ZOOMS, ZEN_MODE, MINIMAL_PANELS, PANELS_DOCKED, EXPLORER_VIEW],
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

export const ACTIVITY_PANEL_OPENED = opened(
  'Activity Panel Opened',
  'The Activity panel expanded from minimised, or opened from the mobile dock. Its mounting also counts in Timeline & Activity.',
  (t) => t === 'Activity',
);

export const TOUR_OFFERED = opened(
  'Tour Offered',
  'The welcome tour offered.',
  (t) => t === 'TourOffer',
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
    ACTIVITY_PANEL_OPENED,
    OTHER_OPENED,
  ],
  seeAlso: { view: 'editing', label: 'See Each Dialog on the Editing Tab' },
};

// Look and feel (Look & Feel tab has the rankings).
export const TEMPLATES_USED = chart(
  'Template',
  'Used',
  'Templates Used',
  'A template picked to start a diagram or seed a tab.',
);

export const THEMES_CHOSEN = chart(
  'Theme',
  'Changed',
  'Themes Chosen',
  'A built-in theme picked, at creation or later.',
  { typeIn: (t) => !CUSTOM_THEME_TYPES.has(t ?? '') },
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

export const CUSTOM_THEMES = chart(
  'Theme',
  'Created',
  'Custom Themes',
  'The custom-theme builder: created, applied, edited, deleted, and elements reset to their theme.',
  { actionIn: ['Changed', 'Deleted'], typeIn: (t) => CUSTOM_THEME_TYPES.has(t ?? '') },
);

export const LOOK_AND_FEEL: MetricStack = {
  stack: true,
  title: 'Look & Feel',
  blurb:
    'The visual presets people reach for: templates, themes, canvas styles, and their own themes. Headed by themes and canvas styles picked: a template also applies its theme, so adding templates would count that pick twice.',
  members: [
    TEMPLATES_USED,
    THEMES_CHOSEN,
    CANVAS_STYLES_PICKED,
    CANVAS_CONTROLS_TWEAKED,
    CUSTOM_THEMES,
  ],
  headline: [THEMES_CHOSEN, CANVAS_STYLES_PICKED],
  seeAlso: { view: 'lookfeel', label: 'See Each Preset on the Look & Feel Tab' },
};
