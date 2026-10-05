// The built-in item types (docs/specs/025-plan/items.md "Item types"). A type
// names the fields its item panel offers; any item may still carry others.
// `glyph` is an id from the Plan glyph set (glyphs.ts). A document may replace this
// catalogue with its own (type-catalogue.ts, docs/specs/025-plan/item-types.md).
import type { PlanGlyphId } from './glyphs';

export type ItemFieldId =
  | 'title'
  | 'description'
  | 'status'
  | 'assignee'
  | 'priority'
  | 'labels'
  | 'estimate'
  | 'due'
  | 'checklist'
  | 'parent'
  | 'votes';

// A field a person adds to a type (docs/specs/025-plan/item-types.md "An item type"): its value is
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
}

const WORK: readonly ItemFieldId[] = [
  'title',
  'description',
  'status',
  'assignee',
  'priority',
  'estimate',
  'due',
  'checklist',
  'labels',
  'parent',
];

export const ITEM_TYPES = [
  {
    id: 'task',
    label: 'Task',
    newTitle: 'New task',
    glyph: 'task',
    color: '#2563eb',
    fields: WORK,
  },
  {
    id: 'story',
    label: 'Story',
    newTitle: 'New story',
    glyph: 'story',
    color: '#16a34a',
    fields: WORK,
  },
  {
    id: 'bug',
    label: 'Bug',
    newTitle: 'New bug',
    glyph: 'bug',
    color: '#dc2626',
    fields: WORK,
  },
  {
    id: 'epic',
    label: 'Epic',
    newTitle: 'New epic',
    glyph: 'epic',
    color: '#7c3aed',
    fields: ['title', 'description', 'status', 'assignee', 'priority', 'due', 'labels'],
  },
  {
    id: 'note',
    label: 'Note',
    newTitle: 'New note',
    glyph: 'note',
    color: '#d97706',
    fields: ['title', 'description', 'status', 'votes'],
  },
  {
    id: 'idea',
    label: 'Idea',
    newTitle: 'New idea',
    glyph: 'idea',
    color: '#0d9488',
    fields: ['title', 'description', 'status', 'votes', 'labels'],
  },
  {
    id: 'action',
    label: 'Action',
    newTitle: 'New action',
    glyph: 'action',
    color: '#db2777',
    fields: ['title', 'status', 'assignee', 'due'],
  },
  {
    id: 'risk',
    label: 'Risk',
    newTitle: 'New risk',
    glyph: 'risk',
    color: '#ea580c',
    fields: ['title', 'description', 'status', 'priority', 'assignee'],
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

const BY_ID = new Map<string, ItemTypeDef>(ITEM_TYPES.map((t) => [t.id, t]));

export function itemTypeOf(id: string): ItemTypeDef {
  return BY_ID.get(id) ?? FALLBACK_ITEM_TYPE;
}

export function isKnownItemType(id: string): id is ItemTypeId {
  return BY_ID.has(id);
}

// Matches "bug", "Bug", "bugs" to a type, for quick add's leading `bug:`.
export function itemTypeByName(name: string): ItemTypeDef | undefined {
  const n = name.trim().toLowerCase();
  return ITEM_TYPES.find((t) => t.id === n || `${t.id}s` === n || t.label.toLowerCase() === n);
}
