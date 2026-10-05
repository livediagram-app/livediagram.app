// The built-in item types (docs/specs/025-plan/items.md "Item types"). A type
// names the fields its item panel offers; any item may still carry others.
// `icon` is an id from the line-art icon catalogue (@livediagram/icons).

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

export interface ItemTypeDef {
  id: string;
  label: string;
  // The title a new item of this type gets from a palette tile.
  newTitle: string;
  icon: string;
  // The stripe and glyph colour on a card face.
  color: string;
  fields: readonly ItemFieldId[];
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
    icon: 'check-circle',
    color: '#2563eb',
    fields: WORK,
  },
  {
    id: 'story',
    label: 'Story',
    newTitle: 'New story',
    icon: 'book',
    color: '#16a34a',
    fields: WORK,
  },
  {
    id: 'bug',
    label: 'Bug',
    newTitle: 'New bug',
    icon: 'alert-octagon',
    color: '#dc2626',
    fields: WORK,
  },
  {
    id: 'epic',
    label: 'Epic',
    newTitle: 'New epic',
    icon: 'layers',
    color: '#7c3aed',
    fields: ['title', 'description', 'status', 'assignee', 'priority', 'due', 'labels'],
  },
  {
    id: 'note',
    label: 'Note',
    newTitle: 'New note',
    icon: 'message',
    color: '#d97706',
    fields: ['title', 'description', 'status', 'votes'],
  },
  {
    id: 'idea',
    label: 'Idea',
    newTitle: 'New idea',
    icon: 'zap',
    color: '#0d9488',
    fields: ['title', 'description', 'status', 'votes', 'labels'],
  },
  {
    id: 'action',
    label: 'Action',
    newTitle: 'New action',
    icon: 'target',
    color: '#db2777',
    fields: ['title', 'status', 'assignee', 'due'],
  },
  {
    id: 'risk',
    label: 'Risk',
    newTitle: 'New risk',
    icon: 'alert-triangle',
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
  icon: 'file',
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
