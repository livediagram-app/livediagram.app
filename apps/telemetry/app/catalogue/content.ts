// What gets made: documents, tabs, elements added and edited, undo, export and import (docs/specs/017-telemetry/telemetry.md).
// Part of the metric catalogue: import from ../metric-catalogue.

import { PALETTE_TELEMETRY_TYPES, SHEET_CHANGE_KINDS } from '@livediagram/api-schema';
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
export const JUST_DRAW = chart(
  'UI',
  'Used',
  'Start Blank',
  'Straight to a blank canvas, skipping the wizard: the Start Blank shortcut into /new, or Start Blank in the template picker.',
  { types: ['JustDraw'] },
);

// Escape in the New Document wizard: back to where they came from, nothing made
// (docs/specs/007-editor/new-document-route.md "Escape backs out").
export const NEW_DOCUMENT_BACKED_OUT = chart(
  'UI',
  'Closed',
  'New Document Backed Out',
  'Escape or the X in the New Document wizard went back to the page that opened it, creating nothing.',
  { types: ['NewDocument'] },
);

// The template step's expand toggle (docs/specs/008-canvas/canvas-and-palette.md "Templates section"):
// whether people want a whole category at once over the carousel.
export const TEMPLATE_SHELF_EXPANDED = chart(
  'UI',
  'Toggled',
  'Template Shelf Expanded',
  'The expand toggle in the New Document wizard flipped: every template in the open category at once (Expanded), or back to the carousel (Collapsed).',
  { types: ['TemplateShelfExpanded', 'TemplateShelfCollapsed'] },
);

// The template step's mode filter (docs/specs/007-editor/templates-by-mode.md): which modes people
// narrow the catalogue to.
export const TEMPLATE_MODE_FILTER = chart(
  'UI',
  'Toggled',
  'Template Mode Filter',
  'The mode filter in the New Document wizard changed: every template (Everything), or only the Diagram, Draw or Illustrate ones.',
  {
    types: [
      'TemplateModeAll',
      'TemplateModeDiagram',
      'TemplateModeDraw',
      'TemplateModeIllustrate',
      'TemplateModePlan',
      'TemplateModeFacilitate',
    ],
  },
);

export const TEMPLATE_LINKS = chart(
  'UI',
  'Used',
  'Template Links',
  'A document made straight from a template link into /new, skipping the wizard.',
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
  'A link put on an element or a table cell: a web address, another document, or another tab.',
  { types: ['Url', 'Document', 'Tab'] },
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
  'A tab linked into another document, so both documents share it and edits in either show in both.',
);

export const TABS_LOCKED = chart(
  'Tab',
  'Locked',
  'Tabs Locked & Unlocked',
  'A tab locked against edits, or unlocked.',
  { actionIn: ['Unlocked'] },
);

// Document lifecycle.
export const DOCUMENTS_LOADED: Metric = {
  category: 'Document',
  action: 'Loaded',
  type: null,
  title: 'Documents Loaded',
  blurb:
    'A document was opened, counted on every open (including a page refresh), not just the first time. Includes the first open of every new document, straight after it is created.',
};

export const DOCUMENTS_CREATED: Metric = {
  category: 'Document',
  action: 'Created',
  allTypes: true,
  title: 'Documents Created',
  blurb:
    'New documents from the New Document wizard, stored in the cloud or offline in this browser.',
};

export const DOCUMENTS_RENAMED: Metric = {
  category: 'Document',
  action: 'Renamed',
  type: null,
  title: 'Documents Renamed',
};

export const DOCUMENTS_DELETED: Metric = {
  rising: 'neutral',
  category: 'Document',
  action: 'Deleted',
  type: null,
  title: 'Documents Deleted',
};

export const DOCUMENTS_DUPLICATED: Metric = {
  category: 'Document',
  action: 'Duplicated',
  allTypes: true,
  title: 'Documents Duplicated',
  blurb: 'A document copied from the Explorer, or a shared document cloned into your own account.',
};

// Offline Mode (docs/specs/006-document/offline-mode.md): a document kept only in this browser, and the two
// conversions between the stores. Created Offline is a subset of Documents
// Created, so it sits in Document Actions outside the headline as well as
// heading its own stack.
export const CREATED_OFFLINE = chart(
  'Document',
  'Created',
  'Created Offline',
  'A new document kept only in this browser (Offline Mode), never sent to the server. Part of Documents Created.',
  { types: ['Offline'] },
);

export const TAKEN_OFFLINE = chart(
  'Document',
  'Moved',
  'Taken Offline',
  'A cloud document converted to Offline Mode with Take Offline, so it now lives only in this browser.',
  { types: ['TakenOffline'] },
);

export const SAVED_TO_CLOUD = chart(
  'Document',
  'Moved',
  'Saved to Cloud',
  'An offline document synced up to the server with Sync Document, so it can be shared.',
  { types: ['SavedToCloud'], rising: 'neutral' },
);

// The move prompt after signing in (docs/specs/014-identity/auth-and-guest-access.md "Moving Local only
// documents after signing in"): offered (homed with the other opens, features.ts), taken, or put off.
// Each document it moves is a Saved to Cloud.
export const LOCAL_MOVE_ACCEPTED = chart(
  'UI',
  'Selected',
  'Move Prompt Accepted',
  'Move, pressed on that prompt. Each document it moved also counts in Saved to Cloud.',
  { types: ['LocalMovePrompt'] },
);

export const LOCAL_MOVE_DISMISSED = chart(
  'UI',
  'Closed',
  'Move Prompt Put Off',
  'Not Now on that prompt: asked again only when there are more documents to move.',
  { types: ['LocalMovePrompt'], rising: 'neutral' },
);

export const OFFLINE_MODE: MetricStack = {
  stack: true,
  title: 'Offline Mode',
  blurb:
    'Documents kept only in this browser (where a guest starts): made offline, taken offline from the cloud, synced back up, and the offer to move them after signing in.',
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
    "A tab's content was fetched for viewing, counted each time (the first tab when a document opens, then each tab switched to).",
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
    'A tab or selection exported, across every format (PNG, SVG, PDF, JSON, Mermaid, Markdown, Excalidraw). For the text formats, copying to the clipboard counts as an export too.',
};

// The document + tab lifecycle as stacks (Dashboard). Loaded is the opens
// signal (every open, including a page refresh and a new document's first),
// read against the once-per-object Created beside it. It is a different unit
// from the changes, and counts every new document a second time, so neither
// head adds it in: each totals the changes made.
export const DOCUMENT_ACTIONS: MetricStack = {
  stack: true,
  title: 'Document Actions',
  blurb:
    'Documents opened, made, renamed, deleted and duplicated, and how new ones were started: Start Blank, a template link, or offline (those three are part of Documents Created), how often the wizard was backed out of with Escape, and how often its template shelf was expanded.',
  members: [
    DOCUMENTS_LOADED,
    DOCUMENTS_CREATED,
    DOCUMENTS_RENAMED,
    DOCUMENTS_DELETED,
    DOCUMENTS_DUPLICATED,
    JUST_DRAW,
    TEMPLATE_LINKS,
    CREATED_OFFLINE,
    NEW_DOCUMENT_BACKED_OUT,
    TEMPLATE_SHELF_EXPANDED,
    TEMPLATE_MODE_FILTER,
  ],
  headline: [DOCUMENTS_CREATED, DOCUMENTS_RENAMED, DOCUMENTS_DELETED, DOCUMENTS_DUPLICATED],
};

// The Trash (docs/specs/013-workspace/trash.md): the backstop behind every
// document delete. Whether anyone comes back for a deleted document is the
// question, so restores lead; each chart counts every Trash (Personal, Team,
// Local).
export const TRASH_OPENED = chart(
  'Trash',
  'Opened',
  'Trash Opened',
  'The Trash opened from Settings.',
);

export const DOCUMENTS_RESTORED = chart(
  'Trash',
  'Restored',
  'Documents Restored',
  'A deleted document brought back from the Trash, from the Trash itself or from its deleted page.',
);

export const DOCUMENTS_DELETED_FOR_GOOD = chart(
  'Trash',
  'Deleted',
  'Deleted for Good',
  'A document in the Trash deleted permanently, ahead of its 30 days.',
  { rising: 'neutral' },
);

export const TRASH_EMPTIED = chart(
  'Trash',
  'Cleared',
  'Trash Emptied',
  'Empty Trash on one group: your documents, a team, or this browser.',
  { rising: 'neutral' },
);

export const TRASH: MetricStack = {
  rising: 'neutral',
  stack: true,
  title: 'Trash',
  blurb:
    'Deleted documents wait 30 days in the Trash. Opening it, restoring from it, deleting for good, and emptying it.',
  members: [DOCUMENTS_RESTORED, TRASH_OPENED, DOCUMENTS_DELETED_FOR_GOOD, TRASH_EMPTIED],
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
    'Tabs opened, then everything done to one: made, renamed, deleted, duplicated, restyled, auto-arranged, reordered, linked into another document, locked and cleared.',
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
  // Article inserts (`Article…`) are their own card (Article Inserts, features.ts).
  typeIn: (type) =>
    !PALETTE_KINDS.has(canonicalElementType(type)) &&
    !isTablePart(type) &&
    !/^Article[A-Z]/.test(type ?? ''),
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

// ---- Every other event, so nothing lands only in Search (docs/specs/017-telemetry/telemetry.md) ----------
// `metric-emitters.test` fails if an event the repo can send has no chart.

// Element editing: everything done to an element after it is placed.
export const ELEMENTS_CHANGED = chart(
  'Element',
  'Changed',
  'Elements Changed',
  'Restyled or edited: colour, text, arrow ends, size, presets, the format painter and more.',
  // An article's writing formatted (`Article…`) is its own card (Article Formatting, features.ts),
  // as are a logo page's tools (Logo Tools Used).
  { typeIn: (t) => !/^Article[A-Z]/.test(t ?? '') && !LOGO_TOOL_TYPES.includes(t ?? '') },
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
  // Image search picks have their own chart below.
  { typeIn: (type) => type !== 'ImageSearch' },
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

export const LANES_SETTLED = chart(
  'Canvas',
  'Used',
  'Boards Lined Up On Lanes',
  'An older event-storming board opened for the first time since notes always sit on a lane, its stray notes lined up in one undoable step.',
  { types: ['LanesSettled'] },
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
    INSERTED_BETWEEN,
    NEXT_NOTES_ADDED,
    NOTE_KINDS_CHANGED,
    LANES_SETTLED,
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
  'A tab imported from draw.io, Excalidraw, Mermaid, Markdown or JSON.',
);

export const PASTES_FROM_EXCALIDRAW = chart(
  'Element',
  'Imported',
  'Pasted from Excalidraw',
  'Drawings copied in Excalidraw and pasted or dropped onto the canvas.',
);

export const EXPORT_AND_IMPORT: MetricStack = {
  stack: true,
  title: 'Export & Import',
  blurb:
    'Diagrams leaving livediagram as files and text, and tabs and drawings coming in from other tools.',
  members: [EXPORTS, EXPORT_OPTIONS, TAB_IMPORTS, PASTES_FROM_EXCALIDRAW],
  seeAlso: { view: 'editing', label: 'See Each Export Format on the Editing Tab' },
};

// Plan mode (docs/specs/026-plan/plan-mode.md "Telemetry"): items made, moved, opened, voted on and
// deleted, and boards set up and revealed. Whether boards are used for work, not just drawn.
export const PLAN_ITEMS_ADDED = chart(
  'Plan',
  'Added',
  'Items Added',
  'An item made on a Plan board, or a Plan card placed from the palette or dragged off a board.',
);

export const PLAN_ITEMS_MOVED = chart(
  'Plan',
  'Moved',
  'Cards Moved',
  'A card moved to another column, row or place on a Plan board, or to the archive (Archive).',
);

export const PLAN_ITEMS_RESTORED = chart(
  'Plan',
  'Restored',
  'Cards Restored',
  'An archived card brought back onto the boards.',
  { rising: 'neutral' },
);

export const PLAN_REMOVED = chart(
  'Plan',
  'Removed',
  'Filters Removed',
  'A filter taken off a Card Search view.',
  { rising: 'neutral' },
);

export const PLAN_ITEMS_OPENED = chart(
  'Plan',
  'Opened',
  'Items Opened',
  'An item opened in the item panel, from a board or a Plan card.',
);

export const PLAN_ITEMS_DELETED = chart(
  'Plan',
  'Deleted',
  'Items Deleted',
  'An item deleted from the item panel or with the keyboard.',
  { rising: 'neutral' },
);

export const PLAN_FLAGS = chart(
  'Plan',
  'Toggled',
  'Cards Flagged',
  'A card flagged for attention, or its flag taken off, from its menu or the item panel.',
  { types: ['FlagOn', 'FlagOff'] },
);

export const PLAN_MAXIMISED = chart(
  'Plan',
  'Toggled',
  'Boards Maximised',
  'A board or a view maximised to fill the screen from its header, or restored to the canvas.',
  {
    types: [
      'BoardMaximised',
      'ViewMaximised',
      'SheetMaximised',
      'BoardRestored',
      'ViewRestored',
      'SheetRestored',
    ],
    rising: 'neutral',
  },
);

export const PLAN_FOCUSED = chart(
  'Plan',
  'Toggled',
  'Boards and Sheets Focused',
  "A board's or a Sheet's Focus pressed in its header: the view glides to fit it (or, pressed again, the whole tab).",
  { types: ['BoardFocused', 'SheetFocused'], rising: 'neutral' },
);

export const PLAN_FILL_TAB = chart(
  'Plan',
  'Toggled',
  'Boards and Sheets Filling a Tab',
  'A board or Sheet set to fill its tab for everyone (the rest of its canvas deleted), or put back on the canvas.',
  { types: ['FillTabOn', 'FillTabOff', 'SheetFillTabOn', 'SheetFillTabOff'], rising: 'neutral' },
);

export const PLAN_CARD_TYPES_DUPLICATED = chart(
  'Plan',
  'Duplicated',
  'Card Types Duplicated',
  'A new card type made by duplicating an existing one in the Card Types panel.',
  { rising: 'neutral' },
);

export const PLAN_SETUP_CHANGED = chart(
  'Plan',
  'Changed',
  'Boards Set Up',
  "A Plan board's set-up changed: columns, WIP limits, rows, scope, card fields, voting or hide writing.",
);

export const PLAN_REVEALED = chart(
  'Plan',
  'Revealed',
  'Boards Revealed',
  'Reveal pressed on a board hiding writing, turning every card face up.',
);

export const SHEET_CHANGES = chart(
  'Sheet',
  'Changed',
  'Sheet Changes',
  'A change to a Sheet: a cell or formula saved, formatting, rows or columns, a sort, filter, paste or fill. One per change, never what was typed.',
  { types: [...SHEET_CHANGE_KINDS] },
);

export const SHEET_FUNCTIONS = chart(
  'Sheet',
  'Used',
  'Sheet Functions Used',
  'A function used in a Sheet formula for the first time in that formula, by name.',
);

export const SHEET_FIND = chart(
  'Sheet',
  'Opened',
  'Sheet Panels Opened',
  "Find, or a Sheet's settings cog, opened on a Sheet.",
  { types: ['Find', 'Settings'] },
);

export const SHEET_CREATED = chart(
  'Sheet',
  'Created',
  'Sheets Set Up and Charts Made',
  'A Sheet set up from Setup Sheet (by how it started), or a chart made from its cells.',
  { types: ['Blank', 'Budget', 'Tracker', 'Timesheet', 'Contacts', 'Cards', 'Csv', 'Chart'] },
);

export const SHEET_CSV_IMPORTED = chart(
  'Sheet',
  'Imported',
  'Sheets From CSV',
  'A Sheet filled from a CSV file: Import CSV, or a CSV dropped on the canvas in Plan mode.',
  { types: ['Csv'] },
);

export const SHEET_DELETED = chart(
  'Sheet',
  'Deleted',
  'Sheets Deleted With Their Element',
  'Deleting a Sheet element whose sheet nothing else used asked first: Confirmed deleted the sheet too, Cancelled kept both.',
  { types: ['Confirmed', 'Cancelled'] },
);

export const SHEET_CSV_EXPORTED = chart(
  'Sheet',
  'Exported',
  'Sheets Downloaded as CSV',
  "A Sheet's cells downloaded as a CSV file.",
  { types: ['Csv'] },
);

export const SHEETS: MetricStack = {
  stack: true,
  title: 'Sheets',
  blurb:
    'Work in Sheets, the spreadsheet tabs on Plan tabs: setup, changes, functions, charts, panels and CSV.',
  members: [
    SHEET_CREATED,
    SHEET_CHANGES,
    SHEET_FUNCTIONS,
    SHEET_FIND,
    SHEET_CSV_IMPORTED,
    SHEET_CSV_EXPORTED,
    SHEET_DELETED,
  ],
};

export const PLAN_BOARDS: MetricStack = {
  stack: true,
  title: 'Plan boards',
  blurb: 'Work on Plan boards: items made, moved, opened, voted on and deleted, and boards set up.',
  members: [
    PLAN_ITEMS_ADDED,
    PLAN_ITEMS_MOVED,
    PLAN_ITEMS_OPENED,
    PLAN_ITEMS_DELETED,
    PLAN_ITEMS_RESTORED,
    PLAN_REMOVED,
    PLAN_FLAGS,
    PLAN_MAXIMISED,
    PLAN_FOCUSED,
    PLAN_FILL_TAB,
    PLAN_SETUP_CHANGED,
    PLAN_CARD_TYPES_DUPLICATED,
    PLAN_REVEALED,
  ],
};
