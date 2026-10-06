// The built-in item types (docs/specs/026-plan/items.md "Item types"). A type
// names the fields its item panel offers; any item may still carry others.
// `glyph` is an id from the Plan glyph set (glyphs.ts). A document may replace this
// catalogue with its own (type-catalogue.ts, docs/specs/026-plan/item-types.md).
import type { PlanGlyphId } from './glyphs';

export type ItemFieldId =
  | 'title'
  | 'description'
  | 'status'
  | 'assignee'
  | 'priority'
  | 'labels'
  | 'estimate'
  // When the work begins (docs/specs/026-plan/items.md "Fields"): a Project's bar on the Gantt chart.
  | 'start'
  | 'due'
  | 'checklist'
  | 'parent'
  | 'votes'
  // Archived (docs/specs/026-plan/items.md "Archive"): kept, but off every board but an Archive board.
  | 'archived'
  // Flagged (docs/specs/026-plan/items.md "Flags"): marked for attention, on every board it is on.
  | 'flagged';

// A field a person adds to a type (docs/specs/026-plan/item-types.md "An item type"): its value is
// an ordinary entry in the item's `fields`, under `id`.
export const CUSTOM_FIELD_KINDS = [
  'text',
  'longtext',
  'number',
  'date',
  'checkbox',
  'link',
  'choice',
] as const;
export type CustomFieldKind = (typeof CUSTOM_FIELD_KINDS)[number];

export interface CustomFieldDef {
  id: string;
  label: string;
  kind: CustomFieldKind;
  // Choice's options, in order.
  options?: readonly string[];
  // Drawn on the card face, after the board's card fields.
  onCard?: boolean;
}

// A tab of an item type's panel (docs/specs/026-plan/item-types.md "An item type"): the fields it shows.
export interface ItemTypeTab {
  id: string;
  label: string;
  fields: readonly string[];
}

export interface ItemTypeDef {
  id: string;
  label: string;
  // The title a new item of this type gets from a palette tile.
  newTitle: string;
  glyph: PlanGlyphId | string;
  // The stripe and glyph colour on a card face.
  color: string;
  // The fields its item panel offers, in order: built-in field ids and its custom fields' ids.
  fields: readonly string[];
  custom?: readonly CustomFieldDef[];
  // The name the panel gives Details (its side column, and the phone's first tab); absent is "Details".
  detailsLabel?: string;
  // The panel's tabs; absent is one Overview tab (tabsOf).
  tabs?: readonly ItemTypeTab[];
}

// Parent right under Status and Assignee: what a piece of work belongs to is read with who has it.
// No Start: only a Project, a bar on the Gantt chart, starts by default.
const WORK: readonly ItemFieldId[] = [
  'title',
  'description',
  'status',
  'assignee',
  'parent',
  'priority',
  'estimate',
  'due',
  'checklist',
  'labels',
];

export const ITEM_TYPES = [
  {
    id: 'project',
    label: 'Project',
    newTitle: 'New project',
    glyph: 'project',
    color: '#18181b',
    fields: ['title', 'description', 'status', 'assignee', 'priority', 'start', 'due', 'labels'],
  },
  {
    id: 'task',
    label: 'Task',
    newTitle: 'New task',
    glyph: 'task',
    color: '#71717a',
    fields: WORK,
  },
  {
    id: 'note',
    label: 'Note',
    newTitle: 'New note',
    glyph: 'note',
    color: '#2563eb',
    fields: ['title', 'description', 'status', 'votes'],
  },
  {
    id: 'idea',
    label: 'Idea',
    newTitle: 'New idea',
    glyph: 'idea',
    color: '#eab308',
    fields: ['title', 'description', 'status', 'votes', 'labels'],
  },
  {
    id: 'action',
    label: 'Action',
    newTitle: 'New action',
    glyph: 'action',
    color: '#dc2626',
    fields: ['title', 'description', 'status', 'assignee', 'due', 'checklist'],
  },
] as const satisfies readonly ItemTypeDef[];

export type ItemTypeId = (typeof ITEM_TYPES)[number]['id'];

export const ITEM_TYPE_IDS: readonly ItemTypeId[] = ITEM_TYPES.map((t) => t.id);

// An unknown type (added later, or by an agent) is kept and drawn plainly.
export const FALLBACK_ITEM_TYPE: ItemTypeDef = {
  id: 'item',
  label: 'Item',
  newTitle: 'New item',
  glyph: 'item',
  color: '#64748b',
  fields: ['title', 'description', 'status', 'assignee', 'labels'],
};
