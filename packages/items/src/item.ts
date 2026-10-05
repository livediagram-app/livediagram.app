// An item: one record in a document's item store (docs/specs/025-plan/items.md).
// The canvas only frames items; a Plan board draws many, a Plan card one.

// A field value is any JSON value. Known fields narrow it (fields.ts);
// unknown fields hold scalars or arrays of scalars.
export type ItemFieldValue =
  string | number | boolean | null | ItemFieldValue[] | { [key: string]: ItemFieldValue };

export type ItemFields = Record<string, ItemFieldValue>;

// The display identity of whoever made or changed an item, or is assigned it.
// A type alias, not an interface, so it is assignable to ItemFieldValue.
export type ItemPerson = {
  id: string;
  name: string;
  color: string;
};

export interface Item {
  id: string;
  type: string;
  // The number people say out loud ("#12"): per document, never reused.
  key: number;
  // Fractional ordering key within a column (rank.ts).
  rank: string;
  fields: ItemFields;
  // Raised by one on every write; the higher rev wins when copies meet.
  rev: number;
  createdAt: number;
  updatedAt: number;
  createdBy: ItemPerson;
  updatedBy: ItemPerson;
}

// Where an item goes: a status, and a neighbour within that status's column.
// `after` wins over `before`; neither means the end of the column.
export interface ItemPlace {
  status?: string;
  after?: string | null;
  before?: string | null;
}

export interface ItemCreate {
  id?: string;
  type: string;
  fields: ItemFields;
  place?: ItemPlace;
  // Only to restore a deleted item (undo); the store decides whether it is free.
  key?: number;
}

export interface ItemPatch {
  set?: ItemFields;
  clear?: string[];
  type?: string;
}

// A move may also set a swimlane's field (dropping into Sam's row assigns Sam), clear it (the
// "No assignee" row) or change the type (a type swimlane).
export interface ItemMove extends ItemPlace {
  set?: ItemFields;
  clear?: string[];
  type?: string;
}

// The fields a swimlane drop may set or clear.
export const SWIMLANE_FIELDS = ['assignee', 'priority', 'parent'] as const;

export function itemTitle(item: Pick<Item, 'fields'>): string {
  const title = item.fields['title'];
  return typeof title === 'string' ? title : '';
}

export function itemStatus(item: Pick<Item, 'fields'>): string | undefined {
  const status = item.fields['status'];
  return typeof status === 'string' ? status : undefined;
}

export function isItemPerson(value: unknown): value is ItemPerson {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v['id'] === 'string' && typeof v['name'] === 'string' && typeof v['color'] === 'string'
  );
}

export function itemAssignee(item: Pick<Item, 'fields'>): ItemPerson | undefined {
  const a = item.fields['assignee'];
  return isItemPerson(a) ? a : undefined;
}

export function itemVotes(item: Pick<Item, 'fields'>): Record<string, number> {
  const v = item.fields['votes'];
  if (!v || typeof v !== 'object' || Array.isArray(v)) return {};
  const out: Record<string, number> = {};
  for (const [k, n] of Object.entries(v)) if (typeof n === 'number' && n > 0) out[k] = n;
  return out;
}

export function itemVoteTotal(item: Pick<Item, 'fields'>): number {
  return Object.values(itemVotes(item)).reduce((a, b) => a + b, 0);
}

export function itemLabels(item: Pick<Item, 'fields'>): string[] {
  const l = item.fields['labels'];
  return Array.isArray(l) ? l.filter((x): x is string => typeof x === 'string') : [];
}
