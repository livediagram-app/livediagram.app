// An item: one record in a document's item store (docs/specs/026-plan/items.md).
// The canvas only frames items; a Plan board draws many, a Plan card one.

import { CUSTOM_FIELD_ID_PATTERN } from './type-catalogue';

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
  // Only to restore an item or carry one across (undo, an offline document's sync): votes are
  // otherwise written by voting alone.
  votes?: Record<string, number>;
  // The same for its comment thread (a CommentThread, docs/specs/026-plan/items.md "Comments"), which is
  // otherwise written by the comment writes alone. The api checks it before it is kept.
  comments?: ItemFieldValue;
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
export const SWIMLANE_FIELDS = ['assignee', 'priority'] as const;

// The built-in fields a board can also lane by (docs/specs/026-plan/plan-board.md "Swimlanes by a field").
export const LANE_FIELD_BUILT_INS = ['labels', 'estimate', 'start', 'due'] as const;

// Whether a move may set or clear this field: a swimlane's field, a field lane's built-in, or any custom
// field (a lane by a custom field sets it).
export function isSwimlaneSettable(key: string): boolean {
  return (
    (SWIMLANE_FIELDS as readonly string[]).includes(key) ||
    (LANE_FIELD_BUILT_INS as readonly string[]).includes(key) ||
    CUSTOM_FIELD_ID_PATTERN.test(key)
  );
}

// The flag an archived item carries (docs/specs/026-plan/items.md "Archive").
export const ARCHIVED_FIELD = 'archived';

// Whether a move may set or clear this field: a swimlane's (isSwimlaneSettable), or the archived flag, which a card
// dragged off an Archive board loses in the move itself (one write, one undo step).
export function isMoveSettable(key: string): boolean {
  return isSwimlaneSettable(key) || key === ARCHIVED_FIELD;
}

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

// How many comments an open thread holds (0 when there is none, or it is resolved): the card's comment count.
export function itemCommentCount(item: Pick<Item, 'fields'>): number {
  const t = item.fields['comments'];
  if (!t || typeof t !== 'object' || Array.isArray(t) || t['resolved'] === true) return 0;
  const comments = t['comments'];
  return Array.isArray(comments) ? comments.length : 0;
}

export function itemLabels(item: Pick<Item, 'fields'>): string[] {
  const l = item.fields['labels'];
  return Array.isArray(l) ? l.filter((x): x is string => typeof x === 'string') : [];
}
