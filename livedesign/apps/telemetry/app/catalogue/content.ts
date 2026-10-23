// What gets made: designs, tabs, elements added and edited, undo, export and import (docs/specs/017-telemetry/telemetry.md).
// Part of the metric catalogue: import from ../metric-catalogue.

import { PALETTE_TELEMETRY_TYPES } from '@livedesign/api-schema';
import { canonicalElementType, PALETTE_KINDS, type PaletteTab } from '../palette-types';
import type { Metric, MetricStack } from '../metric-series';
import { chart } from './helpers';
import { LOGO_TOOL_TYPES } from '../logo-types';
import { LOCAL_MOVE_OFFERED } from './features';

// The Element types that are a table's rows and columns, not elements, and
// the table's own switches (docs/specs/017-telemetry/telemetry.md).
const TABLE_PARTS: readonly string[] = ['TableRow', 'TableColumn'];
const TABLE_TOGGLES: readonly string[] = ['TableHeaderRow', 'TableHeaderColumn', 'TableZebra'];
const isTablePart = (type: string | null): boolean => TABLE_PARTS.includes(type ?? '');

// Filling out existing stacks.
export const TEMPLATE_LINKS = chart(
  'UI',
  'Used',
  'Template Links',
  'A design made straight from a template link into /new, skipping the wizard.',
  { types: ['TemplateLink'] },
);

export const TAB_TEXT_DEFAULTS = chart(
  'Tab',
  'Changed',
  'Tab Text Defaults',
  'A tab’s font or default text size changed.',
  { types: ['Font', 'DefaultTextSize'] },
);

export const TAB_FINISH = chart(
  'Tab',
  'Changed',
  'Tab Finish',
  'A tab’s finish changed (Flexible, Professional, Sketch or Marker).',
  { types: ['Finish'] },
);

export const TAB_LOOKS_PICKED = chart(
  'Tab',
  'Changed',
  'Tab Looks',
  'A look picked in Tab Style: theme, finish, font and canvas pattern set at once, a random Mashup rolled, or a seasonal look picked.',
  { types: ['Look', 'Mashup', 'SeasonalLook'] },
);

export const TABS_ARRANGED = chart(
  'Tab',
  'Aligned',
  'Tabs Auto-Arranged',
  'A tab laid out automatically (tree, flowchart or mindmap), or an infographic page tidied.',
);

export const TABS_REORDERED = chart(
  'Tab',
  'Reordered',
  'Tabs Reordered',
  'Tab pills dragged into a new order.',
);

export const LINKS_ADDED = chart(
  'Element',
  'Linked',
  'Links Added',
  'A link put on an element or a table cell: a web address, another design, or another tab.',
  { types: ['Url', 'Design', 'Tab'] },
);

export const LINKS_REMOVED = chart(
  'Element',
  'Unlinked',
  'Links Removed',
  'A link taken off an element or a table cell.',
  { rising: 'neutral' },
);

export const TABS_CLEARED = chart(
  'Tab',
  'Cleared',
  'Tabs Cleared',
  'Everything on a tab removed at once.',
  { rising: 'neutral' },
);

export const TABS_LINKED = chart(
  'Tab',
  'Linked',
  'Tabs Linked',
  'A tab linked into another design, so both designs share it and edits in either show in both.',
);

export const TABS_LOCKED = chart(
  'Tab',
  'Locked',
  'Tabs Locked & Unlocked',
  'A tab locked against edits, or unlocked.',
  { actionIn: ['Unlocked'] },
);

// Design lifecycle.
export const DESIGNS_LOADED: Metric = {
  category: 'Document',
  action: 'Loaded',
  type: null,
  title: 'Designs Loaded',
  blurb:
    'A design was opened, counted on every open (including a page refresh), not just the first time. Includes the first open of every new design, straight after it is created.',
};

export const DESIGNS_CREATED: Metric = {
  category: 'Document',
  action: 'Created',
  allTypes: true,
  title: 'Designs Created',
  blurb: 'New designs from the New Design wizard, stored in the cloud or in This Browser.',
};

export const DESIGNS_RENAMED: Metric = {
  category: 'Document',
  action: 'Renamed',
  type: null,
  title: 'Designs Renamed',
};

export const DESIGNS_DELETED: Metric = {
  rising: 'neutral',
  category: 'Document',
  action: 'Deleted',
  type: null,
  title: 'Designs Deleted',
};

export const DESIGNS_DUPLICATED: Metric = {
  category: 'Document',
  action: 'Duplicated',
  allTypes: true,
  title: 'Designs Duplicated',
  blurb: 'A design copied from the Explorer, or a shared design cloned into your own account.',
};

// Offline Mode (docs/specs/006-design/offline-mode.md): a design kept only in this browser, and the two
// conversions between the stores. Created in This Browser is a subset of Designs
// Created, so it sits in Design Actions outside the headline as well as
// heading its own stack.
export const CREATED_OFFLINE = chart(
  'Document',
  'Created',
  'Created in This Browser',
  'A new design kept only in this browser (Offline Mode), never sent to the server. Part of Designs Created.',
  { types: ['Offline'] },
);

export const TAKEN_OFFLINE = chart(
  'Document',
  'Moved',
  'Taken Offline',
  'A cloud design converted to Offline Mode with Take Offline, so it now lives only in this browser.',
  { types: ['TakenOffline'] },
);

export const SAVED_TO_CLOUD = chart(
  'Document',
  'Moved',
  'Saved to Cloud',
  'A design in This Browser synced up to the server with Sync Design, so it can be shared.',
  { types: ['SavedToCloud'], rising: 'neutral' },
);

// The move prompt after signing in (docs/specs/014-identity/auth-and-guest-access.md "Moving designs in This Browser
// after signing in"): offered (homed with the other opens, features.ts), taken, or put off.
// Each design it moves is a Saved to Cloud.
export const LOCAL_MOVE_ACCEPTED = chart(
  'UI',
  'Selected',
  'Move Prompt Accepted',
  'Move, pressed on that prompt. Each design it moved also counts in Saved to Cloud.',
  { types: ['LocalMovePrompt'] },
);

export const LOCAL_MOVE_DISMISSED = chart(
  'UI',
  'Closed',
  'Move Prompt Put Off',
  'Not Now on that prompt: asked again only when there are more designs to move.',
  { types: ['LocalMovePrompt'], rising: 'neutral' },
);

export const OFFLINE_MODE: MetricStack = {
  stack: true,
  title: 'Offline Mode',
  blurb:
    'Designs kept only in this browser (where a guest starts): made there, taken offline from the cloud, synced back up, and the offer to move them after signing in.',
  members: [
    CREATED_OFFLINE,
    TAKEN_OFFLINE,
    SAVED_TO_CLOUD,
    LOCAL_MOVE_OFFERED,
    LOCAL_MOVE_ACCEPTED,
    LOCAL_MOVE_DISMISSED,
  ],
};

// Tab lifecycle.
export const TABS_LOADED: Metric = {
  category: 'Tab',
  action: 'Loaded',
  type: null,
  title: 'Tabs Loaded',
  blurb:
    "A tab's content was fetched for viewing, counted each time (the first tab when a design opens, then each tab switched to).",
};

export const TABS_CREATED: Metric = {
  category: 'Tab',
  action: 'Created',
  type: null,
  title: 'Tabs Created',
};

export const TABS_RENAMED: Metric = {
  category: 'Tab',
  action: 'Renamed',
  type: null,
  title: 'Tabs Renamed',
};

export const TABS_DELETED: Metric = {
  rising: 'neutral',
  category: 'Tab',
  action: 'Deleted',
  type: null,
  title: 'Tabs Deleted',
};

export const TABS_DUPLICATED: Metric = {
  category: 'Tab',
  action: 'Duplicated',
  type: null,
  title: 'Tabs Duplicated',
};

// Exports sit in the Export & Import stack below.

export const EXPORTS: Metric = {
  category: 'Document',
  action: 'Exported',
  allTypes: true,
  title: 'Exports',
  blurb:
    'A tab or selection exported, across every format (PNG, SVG, PDF, JSON, Logo Kit). For JSON, copying to the clipboard counts as an export too.',
};

// The design + tab lifecycle as stacks (Dashboard). Loaded is the opens
// signal (every open, including a page refresh and a new design's first),
// read against the once-per-object Created beside it. It is a different unit
// from the changes, and counts every new design a second time, so neither
// head adds it in: each totals the changes made.
export const DESIGN_ACTIONS: MetricStack = {
  stack: true,
  title: 'Design Actions',
  blurb:
    'Designs opened, made, renamed, deleted and duplicated, and how new ones were started: Start Blank, a template link, or in This Browser (those three are part of Designs Created), and how often the wizard was backed out of with Escape.',
  members: [
    DESIGNS_LOADED,
    DESIGNS_CREATED,
    DESIGNS_RENAMED,
    DESIGNS_DELETED,
    DESIGNS_DUPLICATED,
    TEMPLATE_LINKS,
    CREATED_OFFLINE,
  ],
  headline: [DESIGNS_CREATED, DESIGNS_RENAMED, DESIGNS_DELETED, DESIGNS_DUPLICATED],
};

// The Trash (docs/specs/013-workspace/trash.md): the backstop behind every
// design delete. Whether anyone comes back for a deleted design is the
// question, so restores lead; each chart counts every Trash (Personal, Team,
// Local).
export const TRASH_OPENED = chart(
  'Trash',
  'Opened',
  'Trash Opened',
  'The Trash opened from Settings.',
);

export const DESIGNS_RESTORED = chart(
  'Trash',
  'Restored',
  'Designs Restored',
  'A deleted design brought back from the Trash, from the Trash itself or from its deleted page.',
);

export const DESIGNS_DELETED_FOR_GOOD = chart(
  'Trash',
  'Deleted',
  'Deleted for Good',
  'A design in the Trash deleted permanently, ahead of its 30 days.',
  { rising: 'neutral' },
);

export const TRASH_EMPTIED = chart(
  'Trash',
  'Cleared',
  'Trash Emptied',
  'Empty Trash on one group: your designs, a team, or this browser.',
  { rising: 'neutral' },
);

export const TRASH: MetricStack = {
  rising: 'neutral',
  stack: true,
  title: 'Trash',
  blurb:
    'Deleted designs wait 30 days in the Trash. Opening it, restoring from it, deleting for good, and emptying it.',
  members: [DESIGNS_RESTORED, TRASH_OPENED, DESIGNS_DELETED_FOR_GOOD, TRASH_EMPTIED],
};

const TAB_CHANGES = [
  TABS_CREATED,
  TABS_RENAMED,
  TABS_DELETED,
  TABS_DUPLICATED,
  TAB_TEXT_DEFAULTS,
  TAB_FINISH,
  TAB_LOOKS_PICKED,
  TABS_ARRANGED,
  TABS_REORDERED,
  TABS_LINKED,
  TABS_LOCKED,
  TABS_CLEARED,
];

export const TAB_ACTIONS: MetricStack = {
  stack: true,
  title: 'Tab Actions',
  blurb:
    'Tabs opened, then everything done to one: made, renamed, deleted, duplicated, restyled, auto-arranged, reordered, linked into another design, locked and cleared.',
  headline: TAB_CHANGES,
  members: [
    TABS_LOADED,
    TABS_CREATED,
    TABS_RENAMED,
    TABS_DELETED,
    TABS_DUPLICATED,
    TAB_TEXT_DEFAULTS,
    TAB_FINISH,
    TAB_LOOKS_PICKED,
    TABS_ARRANGED,
    TABS_REORDERED,
    TABS_LINKED,
    TABS_LOCKED,
    TABS_CLEARED,
  ],
};

// Side by side tabs (docs/specs/007-editor/split-view.md): a tab opened beside the one being
// edited (by dragging its pill to the right edge, or from the tab menu), the editor moved between
// the panes, and
// the split closed.
export const SIDE_BY_SIDE_OPENED: Metric = {
  category: 'Tab',
  action: 'Opened',
  typeIn: (type) => type === 'SideBySideDrag' || type === 'SideBySideMenu',
  title: 'Opened Side by Side',
  blurb: 'A tab opened beside the one being edited: dragged to the right edge, or from its menu.',
};

export const SIDE_BY_SIDE_FOCUSED: Metric = {
  category: 'Tab',
  action: 'Selected',
  typeIn: (type) => type === 'SideBySideClick' || type === 'SideBySideHover',
  title: 'Side by Side Switches',
  blurb:
    'The editor moved to the other pane: a click there, or the pointer resting there. Ranked by which.',
};

export const SIDE_BY_SIDE_CLOSED: Metric = {
  rising: 'neutral',
  category: 'Tab',
  action: 'Closed',
  type: 'SideBySide',
  title: 'Side by Side Closed',
};

export const SIDE_BY_SIDE: MetricStack = {
  stack: true,
  title: 'Side by Side',
  blurb: 'Two tabs on screen at once: how often a split is opened, worked across and closed.',
  headline: SIDE_BY_SIDE_OPENED,
  members: [SIDE_BY_SIDE_OPENED, SIDE_BY_SIDE_FOCUSED, SIDE_BY_SIDE_CLOSED],
};

// Elements added, one chart per palette tab (Palette tab ranks inside each),
// plus every kind the catalogue doesn't list, so together they cover every
// Element·Added exactly once and the stack's total is every element added.
// Copies count: a duplicate or paste adds one per element it creates.
const addedFrom = (tab: PaletteTab, title: string, blurb: string): Metric => ({
  category: 'Element',
  action: 'Added',
  typeIn: (type) =>
    (PALETTE_TELEMETRY_TYPES[tab] as readonly string[]).includes(canonicalElementType(type)),
  title,
  blurb,
});

export const SHAPES_ADDED = addedFrom(
  'shapes',
  'Shapes Added',
  'Boxes, circles, stars, speech bubbles and other primitives.',
);

export const TOOLS_ADDED = addedFrom(
  'tools',
  'Tools Added',
  'Text, arrows, stickies, tables, charts and other building blocks.',
);

export const COMPONENTS_ADDED = addedFrom(
  'components',
  'Components Added',
  'Blocks that lay themselves out: cards, badges, step numbers, banners, callouts, stat rows, heroes.',
);

export const CONCEPTS_ADDED = addedFrom(
  'concepts',
  'Concepts Added',
  'Concept graphics that lay out their own rows: layer stacks, pyramids, funnels and cycles.',
);

export const DEVICES_ADDED = addedFrom('devices', 'Devices Added', 'Device frames and mockups.');

export const ICONS_ADDED = addedFrom('icons', 'Icons Added', 'Line-art and technology icons.');

export const OTHER_ELEMENTS_ADDED: Metric = {
  category: 'Element',
  action: 'Added',
  typeIn: (type) => !PALETTE_KINDS.has(canonicalElementType(type)) && !isTablePart(type),
  title: 'Other Elements Added',
  blurb:
    'Kinds the palette catalogue does not list, such as pasted images. Table rows and columns are in Tables.',
};

export const ELEMENTS_ADDED: MetricStack = {
  stack: true,
  title: 'Elements Added',
  blurb:
    'Everything put on a canvas, by the palette tab it comes from. Copies count too: a duplicate or paste adds one per element.',
  members: [
    SHAPES_ADDED,
    TOOLS_ADDED,
    COMPONENTS_ADDED,
    CONCEPTS_ADDED,
    DEVICES_ADDED,
    ICONS_ADDED,
    OTHER_ELEMENTS_ADDED,
  ],
  seeAlso: { section: 'palette', label: 'See Each Element in Features › Palette' },
};

// ---- Every other event, so nothing lands only in Search (docs/specs/017-telemetry/telemetry.md) ----------
// `metric-emitters.test` fails if an event the repo can send has no chart.

// Element editing: everything done to an element after it is placed.
export const ELEMENTS_CHANGED = chart(
  'Element',
  'Changed',
  'Elements Changed',
  'Restyled or edited: colour, text, arrow ends, size, presets, the format painter and more.',
  // A logo page's tools are their own card (Logo Tools Used), as are a photo page's edits (Photo Edits).
  {
    typeIn: (t) => !LOGO_TOOL_TYPES.includes(t ?? '') && !/^Photo[A-Z]/.test(t ?? ''),
  },
);

export const ELEMENTS_DELETED = chart(
  'Element',
  'Deleted',
  'Elements Deleted',
  'Elements removed, by a delete or the eraser. One per gesture, however many it took. Table rows and columns are in Tables.',
  { typeIn: (t) => !isTablePart(t), rising: 'neutral' },
);

export const ELEMENTS_DUPLICATED = chart(
  'Element',
  'Duplicated',
  'Elements Duplicated',
  'A duplicate made in place.',
);

export const ELEMENTS_COPIED = chart(
  'Element',
  'Copied',
  'Elements Copied',
  'Copied to the clipboard.',
);

export const ARROW_ENDS_ATTACHED = chart(
  'Element',
  'Linked',
  'Arrow Ends Attached',
  'An arrow end dropped onto a shape so it follows it.',
  { types: ['ArrowPoint'] },
);

export const ELEMENTS_REORDERED = chart(
  'Element',
  'Reordered',
  'Elements Reordered',
  'Sent to the back or brought to the front. A table row or column moved is in Tables.',
  { typeIn: (t) => !isTablePart(t) },
);

export const ELEMENT_OPTIONS_TOGGLED = chart(
  'Element',
  'Toggled',
  'Element Options Toggled',
  'Per-element switches: bold, italic and other text styles, and aspect lock. Table header and zebra switches are in Tables.',
  { typeIn: (t) => !TABLE_TOGGLES.includes(t ?? '') },
);

export const ELEMENTS_LOCKED = chart(
  'Element',
  'Locked',
  'Locked & Unlocked',
  'Elements locked in place or unlocked.',
  { actionIn: ['Unlocked'] },
);

export const ELEMENT_ACTIONS_USED = chart(
  'Element',
  'Used',
  'Element Actions Used',
  'Using an element in place: playing a video, or filling an image placeholder.',
  // Image search picks have their own chart below, and a photo page's tools theirs (Photo Tools Used).
  { typeIn: (type) => type !== 'ImageSearch' && !/^Photo[A-Z]/.test(type ?? '') },
);

// Image search (docs/specs/009-elements/image-search.md): searches run in the
// image picker, and the results attached to an image.
export const IMAGE_SEARCHES = chart(
  'Element',
  'Searched',
  'Image Searches',
  "Searches run in the image picker's Search tab, for openly licensed pictures.",
  { types: ['Image'] },
);

export const IMAGE_SEARCH_PICKS = chart(
  'Element',
  'Used',
  'Image Search Picks',
  'A searched picture attached to an image element.',
  { types: ['ImageSearch'] },
);

export const KEYBOARD_SELECTIONS = chart(
  'Element',
  'Selected',
  'Keyboard & Filter Selections',
  'Elements selected from the keyboard, or by selecting everything matching a filter.',
);

export const ELEMENT_EDITING: MetricStack = {
  stack: true,
  title: 'Element Editing',
  blurb:
    'Everything done to an element after it is placed: changed, deleted, copied, attached, reordered.',
  members: [
    ELEMENTS_CHANGED,
    ELEMENTS_DELETED,
    ELEMENTS_DUPLICATED,
    ELEMENTS_COPIED,
    ARROW_ENDS_ATTACHED,
    ELEMENTS_REORDERED,
    ELEMENT_OPTIONS_TOGGLED,
    ELEMENTS_LOCKED,
    ELEMENT_ACTIONS_USED,
    IMAGE_SEARCHES,
    IMAGE_SEARCH_PICKS,
    KEYBOARD_SELECTIONS,
    LINKS_ADDED,
    LINKS_REMOVED,
  ],
  seeAlso: { section: 'editing', label: 'See Each Formatting Control in Features › Editing' },
};

// Tables: the row and column edits inside a table element. They are sent as
// Element events typed TableRow / TableColumn, and the element charts above
// leave them out, so a table row never counts as an element. The table
// itself (Element·Added·Table) stays in Tools Added, and cell and preset
// edits in Elements Changed with the other formatting controls.
export const TABLE_ROWS_ADDED = chart(
  'Element',
  'Added',
  'Rows & Columns Added',
  'A row or column inserted into a table.',
  { types: TABLE_PARTS },
);

export const TABLE_ROWS_REMOVED = chart(
  'Element',
  'Deleted',
  'Rows & Columns Removed',
  'A row or column taken out of a table.',
  { types: TABLE_PARTS, rising: 'neutral' },
);

export const TABLE_ROWS_MOVED = chart(
  'Element',
  'Reordered',
  'Rows & Columns Moved',
  'A table row or column dragged to a new position.',
  { types: TABLE_PARTS },
);

export const TABLE_STYLE_TOGGLES = chart(
  'Element',
  'Toggled',
  'Header & Zebra Toggles',
  'A table header row, header column or zebra striping switched on or off.',
  { types: TABLE_TOGGLES },
);

export const TABLES: MetricStack = {
  stack: true,
  title: 'Tables',
  blurb:
    'Editing inside a table: rows and columns added, removed and moved, and its header and zebra switches.',
  members: [TABLE_ROWS_ADDED, TABLE_ROWS_REMOVED, TABLE_ROWS_MOVED, TABLE_STYLE_TOGGLES],
};

// Undo and redo. (Document·Reverted, the removed Activity panel's per-entry revert, is a
// retired event: dropped before any chart, see retired-events.ts.)
export const UNDOS = chart('Document', 'Undone', 'Undos', 'A change undone.', {
  rising: 'neutral',
});

export const REDOS = chart('Document', 'Redone', 'Redos', 'An undo redone.', { rising: 'neutral' });

export const UNDO_AND_REDO: MetricStack = {
  stack: true,
  title: 'Undo & Redo',
  blurb: 'Changes taken back with undo, or put back with redo.',
  members: [UNDOS, REDOS],
  rising: 'neutral',
};

// Export and import.
export const EXPORT_OPTIONS = chart(
  'UI',
  'Toggled',
  'Export Options',
  'Image export options: the canvas pattern, the isometric view, hidden layers.',
  { types: ['PatternExport', 'IsometricExport', 'HiddenLayersExport'] },
);

export const TAB_IMPORTS = chart(
  'Tab',
  'Imported',
  'Tabs Imported',
  'A tab imported from a livedesign JSON export.',
);

export const EXPORT_AND_IMPORT: MetricStack = {
  stack: true,
  title: 'Export & Import',
  blurb: 'Diagrams leaving livedesign as files and text, and tabs coming in from JSON exports.',
  members: [EXPORTS, EXPORT_OPTIONS, TAB_IMPORTS],
  seeAlso: { section: 'editing', label: 'See Each Export Format in Features › Editing' },
};
