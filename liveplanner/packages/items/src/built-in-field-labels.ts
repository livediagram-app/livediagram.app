// A card type's own names for its built-in fields (docs/specs/026-plan/item-types.md "Edit Field": Built-in fields,
// blueprint item-types.md "Built-in Full edit"): stored on the type as `fieldLabels`, by built-in field id. One place
// names a built-in for everyone: `typeFieldLabel` for a card of one type, `builtInFieldLabel` where several types
// meet (a board's menus, a search, a view, a CSV header), which gives the type's name only when every type there
// holding the field agrees. Pure.
import { cutText } from '@liveworkspace/model-core/text-cut';
import type { ItemFieldId, ItemTypeDef } from './item-types';

// Each built-in field's own name, as the type editor shows it (Title Case).
export const BUILT_IN_FIELD_NAMES: Readonly<Record<ItemFieldId, string>> = {
  title: 'Title',
  description: 'Description',
  status: 'Status',
  assignee: 'Assignee',
  priority: 'Priority',
  color: 'Colour',
  labels: 'Labels',
  estimate: 'Estimate',
  start: 'Start Date',
  due: 'Due Date',
  checklist: 'Checklist',
  attachments: 'Attachments',
  votes: 'Votes',
  comments: 'Comments',
  archived: 'Archived',
  flagged: 'Flagged',
  example: 'Example',
};

// The built-in fields a type may name (and Edit Field opens on): every one a type lists but Title, whose name is
// every card's own.
export const RENAMABLE_BUILT_INS: readonly ItemFieldId[] = [
  'description',
  'status',
  'assignee',
  'priority',
  'color',
  'labels',
  'estimate',
  'start',
  'due',
  'checklist',
  'attachments',
  'votes',
  'comments',
];

// The longest name a type gives a built-in field: a custom field's (CUSTOM_FIELD_LABEL_MAX).
export const FIELD_LABEL_MAX = 32;

export type FieldLabels = Partial<Record<ItemFieldId, string>>;

export function isRenamableBuiltIn(id: string): id is ItemFieldId {
  return (RENAMABLE_BUILT_INS as readonly string[]).includes(id);
}

const isOwnName = (id: ItemFieldId, name: string) =>
  name.toLowerCase() === BUILT_IN_FIELD_NAMES[id].toLowerCase();

/**
 * The names with `id` named `name`: trimmed; blank or the built-in's own name (in any case) drops it. Undefined when
 * no name is left.
 */
export function fieldLabelsWith(
  labels: FieldLabels | undefined,
  id: ItemFieldId,
  name: string,
): FieldLabels | undefined {
  const { [id]: _was, ...rest } = labels ?? {};
  const trimmed = cutText(name.trim(), FIELD_LABEL_MAX).trim();
  const next: FieldLabels = trimmed && !isOwnName(id, trimmed) ? { ...rest, [id]: trimmed } : rest;
  return Object.keys(next).length ? next : undefined;
}

/**
 * A stored type's names as validation reads them: renamable built-in ids to 1 to FIELD_LABEL_MAX characters. A name
 * for a field the type lacks, or the built-in's own name, is dropped. Undefined when none is left; null refuses it.
 */
export function readFieldLabels(
  input: unknown,
  fields: readonly string[],
): FieldLabels | undefined | null {
  if (input === undefined) return undefined;
  if (typeof input !== 'object' || input === null || Array.isArray(input)) return null;
  let out: FieldLabels | undefined;
  for (const [id, raw] of Object.entries(input)) {
    if (!isRenamableBuiltIn(id) || typeof raw !== 'string') return null;
    const name = raw.trim();
    if (!name || name.length > FIELD_LABEL_MAX) return null;
    if (!fields.includes(id) || isOwnName(id, name)) continue;
    out = { ...out, [id]: name };
  }
  return out;
}

/** What a card of `type` calls the built-in `id`: the type's own name, else `fallback` (the built-in's name). */
export function typeFieldLabel(
  type: Pick<ItemTypeDef, 'fieldLabels'> | undefined,
  id: string,
  fallback: string = BUILT_IN_FIELD_NAMES[id as ItemFieldId] ?? id,
): string {
  return type?.fieldLabels?.[id as ItemFieldId] ?? fallback;
}

// The name the types in scope agree on for each built-in (null: none, or they differ), per `types` array: a menu,
// a search and a CSV export read it once per catalogue change, never per card.
const agreed = new WeakMap<readonly ItemTypeDef[], Map<string, string | null>>();

function agreedName(id: string, types: readonly ItemTypeDef[]): string | null {
  let byId = agreed.get(types);
  if (!byId) {
    byId = new Map();
    agreed.set(types, byId);
  }
  const hit = byId.get(id);
  if (hit !== undefined) return hit;
  let name: string | null = null;
  let seen = false;
  for (const t of types) {
    // A type without the field has no say.
    if (!t.fields.includes(id)) continue;
    const own = t.fieldLabels?.[id as ItemFieldId] ?? null;
    if (!seen) {
      name = own;
      seen = true;
    } else if (own !== name) {
      name = null;
    }
    if (name === null) break;
  }
  byId.set(id, name);
  return name;
}

/**
 * The name a place covering several card types (`types`) gives the built-in `id`: the types' own name when every one
 * of them holding the field names it the same, else `fallback` (that place's name for the built-in).
 */
export function builtInFieldLabel(
  id: string,
  types: readonly ItemTypeDef[],
  fallback: string = BUILT_IN_FIELD_NAMES[id as ItemFieldId] ?? id,
): string {
  return agreedName(id, types) ?? fallback;
}

/** The built-in field a name is a type's own name for (any type, case and spaces aside), for an import's columns. */
export function builtInIdOfName(
  name: string,
  types: readonly ItemTypeDef[],
): ItemFieldId | undefined {
  const key = name.trim().toLowerCase();
  if (!key) return undefined;
  for (const t of types)
    for (const [id, label] of Object.entries(t.fieldLabels ?? {}))
      if (label.toLowerCase() === key) return id as ItemFieldId;
  return undefined;
}
