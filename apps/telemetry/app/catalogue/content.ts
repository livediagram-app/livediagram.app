// What gets made: diagrams, tabs, elements added and edited, undo, export and import (spec/22).
// Part of the metric catalogue: import from ../metric-catalogue.

import { PALETTE_TELEMETRY_TYPES } from '@livediagram/api-schema';
import { canonicalElementType, PALETTE_KINDS, type PaletteTab } from '../palette-types';
import type { Metric, MetricStack } from '../metric-series';
import { chart } from './helpers';

// The Element types that are a table's rows and columns, not elements, and
// the table's own switches (spec/22).
const TABLE_PARTS: readonly string[] = ['TableRow', 'TableColumn'];
const TABLE_TOGGLES: readonly string[] = ['TableHeaderRow', 'TableHeaderColumn', 'TableZebra'];
const isTablePart = (type: string | null): boolean => TABLE_PARTS.includes(type ?? '');

// Filling out existing stacks.
export const JUST_DRAW = chart(
  'UI',
  'Used',
  'Just Draw',
  'Straight to a blank canvas, skipping the wizard: the Just Draw shortcut into /new, or Just Draw in the template picker.',
  { types: ['JustDraw'] },
);

export const TEMPLATE_LINKS = chart(
  'UI',
  'Used',
  'Template Links',
  'A diagram made straight from a template link into /new, skipping the wizard.',
  { types: ['TemplateLink'] },
);

export const TAB_TEXT_DEFAULTS = chart(
  'Tab',
  'Changed',
  'Tab Text Defaults',
  'A tab’s font or default text size changed.',
  { types: ['Font', 'DefaultTextSize'] },
);

export const TABS_ARRANGED = chart(
  'Tab',
  'Aligned',
  'Tabs Auto-Arranged',
  'A tab laid out automatically: tree, flowchart or mindmap.',
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
  'A link put on an element or a table cell: a web address, another diagram, or another tab.',
  { types: ['Url', 'Diagram', 'Tab'] },
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
  'Everything on a tab removed at once. (A discarded dot vote is counted under Votes Discarded instead.)',
  { typeIn: (t) => t === null, rising: 'neutral' },
);

export const TABS_LINKED = chart(
  'Tab',
  'Linked',
  'Tabs Linked',
  'A tab linked into another diagram, so both diagrams share it and edits in either show in both.',
);

export const TABS_LOCKED = chart(
  'Tab',
  'Locked',
  'Tabs Locked & Unlocked',
  'A tab locked against edits, or unlocked.',
  { actionIn: ['Unlocked'] },
);

// Diagram lifecycle.
export const DIAGRAMS_LOADED: Metric = {
  category: 'Diagram',
  action: 'Loaded',
  type: null,
  title: 'Diagrams Loaded',
  blurb:
    'A diagram was opened, counted on every open (including a page refresh), not just the first time. Includes the first open of every new diagram, straight after it is created.',
};

export const DIAGRAMS_CREATED: Metric = {
  category: 'Diagram',
  action: 'Created',
  allTypes: true,
  title: 'Diagrams Created',
  blurb:
    'New diagrams from the New Diagram wizard, stored in the cloud or offline in this browser.',
};

export const DIAGRAMS_RENAMED: Metric = {
  category: 'Diagram',
  action: 'Renamed',
  type: null,
  title: 'Diagrams Renamed',
};

export const DIAGRAMS_DELETED: Metric = {
  rising: 'neutral',
  category: 'Diagram',
  action: 'Deleted',
  type: null,
  title: 'Diagrams Deleted',
};

export const DIAGRAMS_DUPLICATED: Metric = {
  category: 'Diagram',
  action: 'Duplicated',
  allTypes: true,
  title: 'Diagrams Duplicated',
  blurb: 'A diagram copied from the Explorer, or a shared diagram cloned into your own account.',
};

// Offline Mode (spec/76): a diagram kept only in this browser, and the two
// conversions between the stores. Created Offline is a subset of Diagrams
// Created, so it sits in Diagram Actions outside the headline as well as
// heading its own stack.
export const CREATED_OFFLINE = chart(
  'Diagram',
  'Created',
  'Created Offline',
  'A new diagram kept only in this browser (Offline Mode), never sent to the server. Part of Diagrams Created.',
  { types: ['Offline'] },
);

export const TAKEN_OFFLINE = chart(
  'Diagram',
  'Moved',
  'Taken Offline',
  'A cloud diagram converted to Offline Mode with Take Offline, so it now lives only in this browser.',
  { types: ['TakenOffline'] },
);

export const SAVED_TO_CLOUD = chart(
  'Diagram',
  'Moved',
  'Saved to Cloud',
  'An offline diagram synced up to the server with Sync Diagram, so it can be shared.',
  { types: ['SavedToCloud'], rising: 'neutral' },
);

export const OFFLINE_MODE: MetricStack = {
  stack: true,
  title: 'Offline Mode',
  blurb:
    'Diagrams kept only in this browser: made offline, taken offline from the cloud, and synced back up.',
  members: [CREATED_OFFLINE, TAKEN_OFFLINE, SAVED_TO_CLOUD],
};

// Tab lifecycle.
export const TABS_LOADED: Metric = {
  category: 'Tab',
  action: 'Loaded',
  type: null,
  title: 'Tabs Loaded',
  blurb:
    "A tab's content was fetched for viewing, counted each time (the first tab when a diagram opens, then each tab switched to).",
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
  category: 'Diagram',
  action: 'Exported',
  allTypes: true,
  title: 'Exports',
  blurb:
    'A tab or selection exported, across every format (PNG, SVG, PDF, JSON, Mermaid, Markdown, Excalidraw). For the text formats, copying to the clipboard counts as an export too.',
};

// The diagram + tab lifecycle as stacks (Dashboard). Loaded is the opens
// signal (every open, including a page refresh and a new diagram's first),
// read against the once-per-object Created beside it. It is a different unit
// from the changes, and counts every new diagram a second time, so neither
// head adds it in: each totals the changes made.
export const DIAGRAM_ACTIONS: MetricStack = {
  stack: true,
  title: 'Diagram Actions',
  blurb:
    'Diagrams opened, made, renamed, deleted and duplicated, and how new ones were started: Just Draw, a template link, or offline. Those three are part of Diagrams Created.',
  members: [
    DIAGRAMS_LOADED,
    DIAGRAMS_CREATED,
    DIAGRAMS_RENAMED,
    DIAGRAMS_DELETED,
    DIAGRAMS_DUPLICATED,
    JUST_DRAW,
    TEMPLATE_LINKS,
    CREATED_OFFLINE,
  ],
  headline: [DIAGRAMS_CREATED, DIAGRAMS_RENAMED, DIAGRAMS_DELETED, DIAGRAMS_DUPLICATED],
};

const TAB_CHANGES = [
  TABS_CREATED,
  TABS_RENAMED,
  TABS_DELETED,
  TABS_DUPLICATED,
  TAB_TEXT_DEFAULTS,
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
    'Tabs opened, then everything done to one: made, renamed, deleted, duplicated, restyled, auto-arranged, reordered, linked into another diagram, locked and cleared.',
  headline: TAB_CHANGES,
  members: [
    TABS_LOADED,
    TABS_CREATED,
    TABS_RENAMED,
    TABS_DELETED,
    TABS_DUPLICATED,
    TAB_TEXT_DEFAULTS,
    TABS_ARRANGED,
    TABS_REORDERED,
    TABS_LINKED,
    TABS_LOCKED,
    TABS_CLEARED,
  ],
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
  'Boxes, circles, flowchart symbols and other primitives.',
);

export const TOOLS_ADDED = addedFrom(
  'tools',
  'Tools Added',
  'Text, arrows, stickies, tables, charts and other building blocks.',
);

export const COLLABORATE_ADDED = addedFrom(
  'collaborate',
  'Collaborate Added',
  'Estimate cards, temperature checks, idea boxes, agendas, decisions and roll calls.',
);

export const COMPONENTS_ADDED = addedFrom(
  'components',
  'Components Added',
  'Web components that lay themselves out: banners, callouts, stat rows, heroes.',
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
    COLLABORATE_ADDED,
    COMPONENTS_ADDED,
    DEVICES_ADDED,
    ICONS_ADDED,
    OTHER_ELEMENTS_ADDED,
  ],
  seeAlso: { view: 'palette', label: 'See Each Element on the Palette Tab' },
};

// ---- Every other event, so nothing lands only in Search (spec/22) ----------
// `metric-emitters.test` fails if an event the repo can send has no chart.

// Element editing: everything done to an element after it is placed.
export const ELEMENTS_CHANGED = chart(
  'Element',
  'Changed',
  'Elements Changed',
  'Restyled or edited: colour, text, arrow ends, size, presets, the format painter and more.',
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
  'Using an element in place: a reaction pad, Bring into Focus, playing a video.',
);

export const KEYBOARD_SELECTIONS = chart(
  'Element',
  'Selected',
  'Keyboard & Filter Selections',
  'Elements selected from the keyboard, or by selecting everything matching a filter.',
);

export const INSERTED_BETWEEN = chart(
  'Canvas',
  'Used',
  'Inserted Between',
  'A note dropped into the gap between two notes on an event-storming board, the board making room for it.',
  { types: ['InsertBetween'] },
);

export const NEXT_NOTES_ADDED = chart(
  'Canvas',
  'Used',
  'Next Notes Added',
  'A next-note tab beside an event-storming note clicked, adding the note the notation puts there.',
  { types: ['AddNextNote'] },
);

export const NOTE_KINDS_CHANGED = chart(
  'Canvas',
  'Used',
  'Note Kinds Changed',
  'An event-storming note turned into another kind, say a domain event into a hotspot.',
  { types: ['ChangeNoteKind'] },
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
    KEYBOARD_SELECTIONS,
    INSERTED_BETWEEN,
    NEXT_NOTES_ADDED,
    NOTE_KINDS_CHANGED,
    LINKS_ADDED,
    LINKS_REMOVED,
  ],
  seeAlso: { view: 'editing', label: 'See Each Formatting Control on the Editing Tab' },
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

// Undo, redo and revert.
export const UNDOS = chart('Diagram', 'Undone', 'Undos', 'A change undone.', { rising: 'neutral' });

export const REDOS = chart('Diagram', 'Redone', 'Redos', 'An undo redone.', { rising: 'neutral' });

export const REVERTS = chart(
  'Diagram',
  'Reverted',
  'Reverts',
  'A diagram rolled back to an earlier point from the Activity panel.',
  { rising: 'neutral' },
);

export const UNDO_AND_REVERT: MetricStack = {
  stack: true,
  title: 'Undo & Revert',
  blurb: 'Changes taken back: undone, redone, or rolled back from the Activity panel.',
  members: [UNDOS, REDOS, REVERTS],
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
  'A tab imported from Excalidraw, Mermaid, Markdown or JSON.',
);

export const EXPORT_AND_IMPORT: MetricStack = {
  stack: true,
  title: 'Export & Import',
  blurb: 'Diagrams leaving livediagram as files and text, and tabs coming in from other tools.',
  members: [EXPORTS, EXPORT_OPTIONS, TAB_IMPORTS],
  seeAlso: { view: 'editing', label: 'See Each Export Format on the Editing Tab' },
};
