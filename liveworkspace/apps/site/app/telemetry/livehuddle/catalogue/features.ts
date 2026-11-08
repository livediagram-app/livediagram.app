// Which features carry the work: the photo import, layers, the palette and canvas modes, look and feel, search, dialogs, chrome, notes, actions, organisation (docs/specs/017-telemetry/telemetry.md).
// Part of the metric catalogue: import from ../metric-catalogue.

import { isHelpArticleType, isSettingsCategory } from '../../_shared/opened-types';
import { SELECTION_MODES } from '../palette-types';
import { NON_PATTERN_CANVAS_TYPES } from '../../_shared/look-feel-types';
import { isNonThemePick } from '../palette-types';
import type { Metric, MetricStack } from '../../_shared/metric-series';
import { chart } from '../../_shared/catalogue-helpers';
import { elementTourTokens } from '../element-tour-kinds';

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
  'An action’s document moved into a team so the assignee can reach it.',
);

export const ACTIONS_REOPENED = chart(
  'Action',
  'Unresolved',
  'Actions Reopened',
  'A completed action marked not done again.',
  { rising: 'neutral' },
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
  'Settings inside a canvas mode: format painter options.',
  { typeIn: (t) => /^Format/.test(t ?? '') },
);

// Shape recognition on a pen stroke (docs/specs/023-draw-mode/draw-mode.md "Shape recognition"): Alt, or the chip on a
// touch screen, flipping the stroke being drawn between ink and the shape it reads as. Tabs set to open in Diagram or
// Draw mode, beside it until Work Tracker #586, went with those modes.
export const WHITEBOARD_RECOGNITION = chart(
  'Draw',
  'Toggled',
  'Shape Recognition',
  'A pen stroke flipped between ink and the shape it reads as, with Alt or the chip on a touch screen.',
);

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
  blurb: 'Actions someone decided against: closed without being done.',
};

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

// The Explorer's filters (docs/specs/013-workspace/explorer-filters.md "Telemetry"):
// Explorer·Selected·<Facet>, one per filter that gained a value, by kind (never what was picked).
export const EXPLORER_FILTERS_PICKED = chart(
  'Explorer',
  'Selected',
  'Explorer Filters Used',
  'A filter reached for in the Explorer, by kind: words, Opens in, Kind, Template, Made by AI, Edited, People or Space, from a chip, a suggestion or a typed token.',
  { rising: 'good' },
);

// Default folders (docs/specs/013-workspace/default-folders.md "Telemetry"): one type per key.
export const DEFAULT_FOLDERS_SET = chart(
  'Folder',
  'Changed',
  'Default Folders Set',
  'A folder chosen as where new documents of one kind land: from a folder menu, the New Document wizard or Settings.',
  { rising: 'good' },
);

export const DEFAULT_FOLDERS_CLEARED = chart(
  'Folder',
  'Cleared',
  'Default Folders Cleared',
  'A default folder cleared, so new documents of that kind land in My Work again.',
  { rising: 'neutral' },
);

export const ORGANISATION: MetricStack = {
  stack: true,
  title: 'Organisation',
  blurb:
    'Folders made and nested, tab folders, tabs and documents filed, tags, default folders, the Explorer sidebar and its filters.',
  members: [
    FOLDERS_CREATED,
    FOLDERS_RE_PARENTED,
    TAB_FOLDERS_CREATED,
    TABS_FILED,
    FOLDERS_DELETED,
    FOLDERS_RENAMED,
    TABS_UNFILED,
    EXPLORER_FILTERS_PICKED,
    DEFAULT_FOLDERS_SET,
    DEFAULT_FOLDERS_CLEARED,
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
      type === 'ToolbarSearchOtherModes' ||
      type === 'ToolbarSearchUnavailable',
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
  FormatPainter: 'Format Painter',
  AvatarMode: 'Avatar Mode',
};

export const MODE_METRICS: readonly Metric[] = SELECTION_MODES.map((mode) =>
  chart(
    'Canvas',
    'Used',
    MODE_TITLES[mode] ?? mode,
    `The ${(MODE_TITLES[mode] ?? mode).toLowerCase().replace(/ mode$/, '')} mode switched on from the palette.`,
    { types: [mode] },
  ),
);

// The office's machines (docs/specs/009-elements/office.md "Using it"): a drink taken in Avatar mode.
export const OFFICE_DRINKS = chart(
  'Canvas',
  'Used',
  'Office Drinks',
  'A drink taken at a water cooler, a coffee machine, a drinks cabinet or a drinks fridge in Avatar mode.',
  { types: ['WaterCooler', 'CoffeeMachine', 'DrinksCabinet', 'DrinksFridge'] },
);

// The workday pieces (docs/specs/009-elements/workday-pieces.md "Telemetry"): a Reception Desk's bell rung, the office
// dog patted.
export const WORKDAY_PIECES_USED = chart(
  'Canvas',
  'Used',
  'Bells and Pats',
  "A Reception Desk's bell rung, or the office dog on a Pet Bed patted, in Avatar mode.",
  { types: ['ReceptionBell', 'PatPet'] },
);

// A ping-pong game played to its end (docs/specs/009-elements/social-pieces.md "Telemetry"), counted once, by the
// left player's screen.
export const PING_PONG_GAMES = chart(
  'Canvas',
  'Used',
  'Ping-Pong Games',
  'A game of ping-pong played to its end at a Ping-Pong Table in a Space.',
  { types: ['PingPong'] },
);

// A Moon Mail run ended at an Arcade Machine, by Game Over or by closing its panel mid-run
// (docs/specs/009-elements/social-pieces.md "Telemetry"), from the player's screen. Never the score or the name.
export const ARCADE_RUNS = chart(
  'Canvas',
  'Used',
  'Moon Mail Runs',
  'A run of Moon Mail played on an Arcade Machine in a Space, to Game Over or closed mid-run.',
  { types: ['Arcade'] },
);

// A Door swung open or shut (docs/specs/009-elements/room-builder.md).
export const DOORS_SWUNG = chart(
  'Canvas',
  'Used',
  'Doors Swung',
  'A Door in a Space swung open or shut.',
  { types: ['Door'] },
);

// A Screen opened large (docs/specs/009-elements/screen-and-room-sign.md).
export const SCREENS_OPENED = chart(
  'Canvas',
  'Used',
  'Screens Opened',
  'A Screen in a meeting room opened large to read what it shows.',
  { types: ['ScreenOpen'] },
);

// Avatar Pad arrivals (docs/specs/009-elements/avatar-pad.md "Telemetry"): an entry into Avatar mode that started on a
// pad, once per entry, never per peer seen arriving.
export const AVATAR_PAD_ARRIVALS = chart(
  'Canvas',
  'Used',
  'Avatar Pad Arrivals',
  'An entry into Avatar mode that started on an Avatar Pad, the character beamed in.',
  { types: ['AvatarPadArrival'] },
);

// Avatar-mode speech bubbles (docs/specs/008-canvas/avatar-mode.md "Speech bubbles"): that somebody spoke, by
// either door, never what they said.
export const AVATAR_MESSAGES = chart(
  'Canvas',
  'Used',
  'Avatar Messages',
  'A message said in a speech bubble in Avatar mode, typed above the character or sent from the Avatar panel.',
  { types: ['AvatarMessage', 'AvatarMessagePanel'] },
);

// What people do in a Space with their characters (docs/specs/008-canvas/avatar-mode.md, docs/specs/009-elements/
// chair.md, office.md, social-pieces.md, workday-pieces.md, room-builder.md, screen-and-room-sign.md): never who,
// never where, never which.
export const AVATAR_ACTIONS = chart(
  'Canvas',
  'Used',
  'Avatar Actions',
  'A move performed from the Avatar palette\u2019s Actions or its keys: a wave, a spin, a cheer, a dance or jumping jacks.',
  { types: ['AvatarAction'] },
);

export const AVATAR_REACTIONS = chart(
  'Canvas',
  'Used',
  'Avatar Reactions',
  'A burst played round the character from the Avatar palette\u2019s React: confetti, sparkles, hearts, applause or fireworks.',
  { types: ['AvatarReaction'] },
);

export const SITS = chart(
  'Canvas',
  'Used',
  'Sat Down',
  'A character sat on a seat: a chair, a sofa, a desk, a bench or any other piece with a seat.',
  { types: ['Sit'] },
);

export const IN_THE_SPACE: MetricStack = {
  stack: true,
  title: 'In the Space',
  blurb:
    'What people do in a Space with their characters: arrive, talk, move, sit, get a drink, play and open the room\u2019s pieces.',
  members: [
    AVATAR_PAD_ARRIVALS,
    AVATAR_MESSAGES,
    AVATAR_ACTIONS,
    AVATAR_REACTIONS,
    SITS,
    OFFICE_DRINKS,
    WORKDAY_PIECES_USED,
    PING_PONG_GAMES,
    ARCADE_RUNS,
    DOORS_SWUNG,
    SCREENS_OPENED,
  ],
};

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
  members: [CANVAS_ZOOMS, LANDSCAPE_BARS, PANELS_DOCKED, EXPLORER_VIEW],
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

// The Avatar tour's offer (docs/specs/008-canvas/avatar-tour.md); charted in its funnel on the Visitors tab.
export const AVATAR_TOUR_OFFERED = opened(
  'Avatar Tour Offered',
  'The Avatar tour offered, the first time someone walks as an avatar. Since 25 October 2026, the Start Tour button in the footer showing it.',
  (t) => t === 'AvatarTourOffer',
);

// The element tours' offers (docs/specs/007-editor/element-tours.md), any `<Kind>TourOffer`; charted in their funnel on
// the Visitors tab, which names the kinds.
export const ELEMENT_TOURS_OFFERED = opened(
  'Element Tours Offered',
  'An element tour offered beside a selected element, once per kind per visit. Since 25 October 2026, the Start Tour button in the footer showing it.',
  (t) => elementTourTokens('Offer').includes(t ?? ''),
);

// The new version prompt (docs/specs/016-platform/new-version-prompt.md); charted with its reloads
// on the Visitors tab.
export const NEW_VERSION_OFFERED = opened(
  'New Version Offered',
  'An open editor heard the server serves a newer document format, and offered a reload.',
  (t) => t === 'NewVersionPrompt',
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

// The Highlighter's next-stroke settings (docs/specs/008-canvas/highlighter.md "Settings"), chosen in
// the quick style panel while its tile is armed. Restyling a drawn highlight is an Element change.
export const HIGHLIGHTER_SETTINGS = chart(
  'UI',
  'Changed',
  'Highlighter Settings',
  "The Highlighter's colour or width changed for the next stroke, in the quick style panel.",
  { types: ['HighlighterColour', 'HighlighterWidth'], rising: 'neutral' },
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
    "The visual presets people reach for: templates (and those found in another mode by a start's search), themes, canvas styles and their own swatches. Headed by themes and canvas styles picked: a template also applies its theme, so adding templates would count that pick twice.",
  members: [
    TEMPLATES_USED,
    THEMES_CHOSEN,
    CANVAS_STYLES_PICKED,
    CANVAS_CONTROLS_TWEAKED,
    CUSTOM_SWATCHES,
    LOOKS_FILTERED,
    HIGHLIGHTER_SETTINGS,
  ],
  headline: [THEMES_CHOSEN, CANVAS_STYLES_PICKED],
  seeAlso: { section: 'lookfeel', label: 'See Each Preset in Features › Look & Feel' },
};
