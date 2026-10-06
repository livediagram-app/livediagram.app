// Field validation (docs/specs/026-plan/blueprints/item-store.md "Validation").
// One function guards every door: the api routes, the offline store and the
// editor's optimistic writes, so a value that passes here is valid everywhere.

import type { ItemFields, ItemFieldValue } from './item';
import type { ItemFieldId } from './item-types';
import { DESCRIPTION_RICH_FIELD, normaliseRichRuns } from './rich-text-field';
import {
  ITEM_CHECKLIST_MAX,
  ITEM_CHECKLIST_TEXT_MAX,
  ITEM_DESCRIPTION_MAX,
  ITEM_FIELDS_BYTES,
  ITEM_FIELDS_MAX,
  ITEM_FIELD_KEY_PATTERN,
  ITEM_ID_PATTERN,
  ITEM_LABELS_MAX,
  ITEM_LABEL_MAX,
  ITEM_NUMBER_MAX,
  ITEM_STATUS_MAX,
  ITEM_TITLE_MAX,
  ITEM_TYPE_PATTERN,
  ITEM_UNKNOWN_ARRAY_MAX,
  ITEM_UNKNOWN_STRING_MAX,
  ITEM_VOTERS_MAX,
  ITEM_VOTES_PER_PERSON_MAX,
} from './limits';

export type ItemFieldKind =
  | 'text'
  | 'long-text'
  | 'status'
  | 'person'
  | 'priority'
  | 'labels'
  | 'number'
  | 'date'
  | 'checklist'
  | 'item-ref'
  | 'votes'
  | 'flag';

export const KNOWN_FIELDS: Readonly<Record<ItemFieldId, ItemFieldKind>> = {
  title: 'text',
  description: 'long-text',
  status: 'status',
  assignee: 'person',
  priority: 'priority',
  labels: 'labels',
  estimate: 'number',
  start: 'date',
  due: 'date',
  checklist: 'checklist',
  parent: 'item-ref',
  votes: 'votes',
  archived: 'flag',
};

export const PRIORITIES = ['urgent', 'high', 'medium', 'low'] as const;
export type Priority = (typeof PRIORITIES)[number];

export const PRIORITY_LABELS: Readonly<Record<Priority, string>> = {
  urgent: 'Urgent',
  high: 'High',
  medium: 'Medium',
  low: 'Low',
};

export function isPriority(v: unknown): v is Priority {
  return typeof v === 'string' && (PRIORITIES as readonly string[]).includes(v);
}

export type ItemRejection =
  | 'title_required'
  | 'title_too_long'
  | 'field_key_invalid'
  | 'field_value_invalid'
  | 'fields_too_many'
  | 'fields_too_large'
  | 'votes_read_only'
  | 'type_invalid'
  | 'id_invalid'
  | 'place_invalid';

export type FieldsResult =
  { ok: true; fields: ItemFields } | { ok: false; error: ItemRejection; field?: string };

export function knownFieldKind(key: string): ItemFieldKind | undefined {
  return Object.prototype.hasOwnProperty.call(KNOWN_FIELDS, key)
    ? KNOWN_FIELDS[key as ItemFieldId]
    : undefined;
}

export function isValidItemId(id: unknown): id is string {
  return typeof id === 'string' && ITEM_ID_PATTERN.test(id);
}

export function isValidItemType(type: unknown): type is string {
  return typeof type === 'string' && ITEM_TYPE_PATTERN.test(type);
}

export function isValidFieldKey(key: string): boolean {
  return ITEM_FIELD_KEY_PATTERN.test(key);
}

const HEX = /^#[0-9a-fA-F]{6}$/;
const DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

function isScalar(v: unknown): v is string | number | boolean | null {
  return (
    v === null ||
    typeof v === 'boolean' ||
    (typeof v === 'number' && Number.isFinite(v)) ||
    (typeof v === 'string' && v.length <= ITEM_UNKNOWN_STRING_MAX)
  );
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}

function validDate(s: string): boolean {
  const m = DATE.exec(s);
  if (!m) return false;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return (
    d.getUTCFullYear() === Number(m[1]) &&
    d.getUTCMonth() === Number(m[2]) - 1 &&
    d.getUTCDate() === Number(m[3])
  );
}

// Normalises one value of a known kind, or returns undefined when it is invalid.
function normaliseKnown(kind: ItemFieldKind, v: unknown): ItemFieldValue | undefined {
  switch (kind) {
    case 'text':
    case 'long-text':
    case 'votes':
      return undefined; // handled by the caller
    case 'status':
      return typeof v === 'string' && v.trim().length > 0 && v.length <= ITEM_STATUS_MAX
        ? v.trim()
        : undefined;
    case 'person': {
      if (!isPlainObject(v)) return undefined;
      const { id, name, color } = v;
      if (typeof id !== 'string' || id.length === 0 || id.length > 64) return undefined;
      if (typeof name !== 'string' || name.length > 80) return undefined;
      if (typeof color !== 'string' || !HEX.test(color)) return undefined;
      return { id, name: name.trim(), color };
    }
    case 'priority':
      return isPriority(v) ? v : undefined;
    case 'labels': {
      if (!Array.isArray(v) || v.length > ITEM_LABELS_MAX) return undefined;
      const out: string[] = [];
      for (const l of v) {
        if (typeof l !== 'string') return undefined;
        const t = l.trim();
        if (t.length === 0 || t.length > ITEM_LABEL_MAX) return undefined;
        if (!out.includes(t)) out.push(t);
      }
      return out;
    }
    case 'number':
      return typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= ITEM_NUMBER_MAX
        ? v
        : undefined;
    case 'date':
      return typeof v === 'string' && validDate(v) ? v : undefined;
    case 'checklist': {
      if (!Array.isArray(v) || v.length > ITEM_CHECKLIST_MAX) return undefined;
      const rows: ItemFieldValue[] = [];
      for (const r of v) {
        if (!isPlainObject(r)) return undefined;
        if (typeof r['text'] !== 'string' || r['text'].length > ITEM_CHECKLIST_TEXT_MAX)
          return undefined;
        if (typeof r['done'] !== 'boolean') return undefined;
        rows.push({ text: r['text'], done: r['done'] });
      }
      return rows;
    }
    case 'item-ref':
      return isValidItemId(v) ? v : undefined;
    // A flag is set (true) or cleared (the key removed); false is not stored.
    case 'flag':
      return v === true ? true : undefined;
  }
}

function normaliseUnknown(v: unknown): ItemFieldValue | undefined {
  if (isScalar(v)) return v;
  if (Array.isArray(v) && v.length <= ITEM_UNKNOWN_ARRAY_MAX && v.every(isScalar)) return v;
  return undefined;
}

// `create` requires a title; `patch` validates only the keys it is given.
// Votes are never accepted here: they change only through voting.
export function validateFields(input: unknown, mode: 'create' | 'patch'): FieldsResult {
  if (!isPlainObject(input)) return { ok: false, error: 'field_value_invalid' };
  const keys = Object.keys(input);
  if (keys.length > ITEM_FIELDS_MAX) return { ok: false, error: 'fields_too_many' };
  const fields: ItemFields = {};
  for (const key of keys) {
    if (!isValidFieldKey(key)) return { ok: false, error: 'field_key_invalid', field: key };
    const v = input[key];
    const kind = knownFieldKind(key);
    if (kind === 'votes') return { ok: false, error: 'votes_read_only', field: key };
    if (kind === 'text') {
      if (typeof v !== 'string') return { ok: false, error: 'field_value_invalid', field: key };
      const t = v.trim();
      if (t.length === 0) return { ok: false, error: 'title_required', field: key };
      if (t.length > ITEM_TITLE_MAX) return { ok: false, error: 'title_too_long', field: key };
      fields[key] = t;
      continue;
    }
    if (key === DESCRIPTION_RICH_FIELD) {
      const runs = normaliseRichRuns(v);
      if (!runs) return { ok: false, error: 'field_value_invalid', field: key };
      fields[key] = runs;
      continue;
    }
    if (kind === 'long-text') {
      if (typeof v !== 'string' || v.length > ITEM_DESCRIPTION_MAX) {
        return { ok: false, error: 'field_value_invalid', field: key };
      }
      fields[key] = v;
      continue;
    }
    const value = kind ? normaliseKnown(kind, v) : normaliseUnknown(v);
    if (value === undefined) return { ok: false, error: 'field_value_invalid', field: key };
    fields[key] = value;
  }
  if (mode === 'create' && typeof fields['title'] !== 'string') {
    return { ok: false, error: 'title_required', field: 'title' };
  }
  return { ok: true, fields };
}

export function fieldsByteSize(fields: ItemFields): number {
  return new TextEncoder().encode(JSON.stringify(fields)).length;
}

export function fieldsWithinBounds(fields: ItemFields): ItemRejection | null {
  if (Object.keys(fields).length > ITEM_FIELDS_MAX) return 'fields_too_many';
  if (fieldsByteSize(fields) > ITEM_FIELDS_BYTES) return 'fields_too_large';
  return null;
}

// Votes a create carries across (a restore, a sync): person ids to whole counts.
export function validateVotes(input: unknown): Record<string, number> | null {
  if (input === undefined) return {};
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
  const entries = Object.entries(input);
  if (entries.length > ITEM_VOTERS_MAX) return null;
  const out: Record<string, number> = {};
  for (const [k, v] of entries) {
    if (k.length === 0 || k.length > 64) return null;
    if (typeof v !== 'number' || !Number.isInteger(v) || v < 1 || v > ITEM_VOTES_PER_PERSON_MAX)
      return null;
    out[k] = v;
  }
  return out;
}

// Keys a patch may clear: any valid key but the title (an item keeps a title).
export function validateClear(
  keys: unknown,
): { ok: true; keys: string[] } | { ok: false; error: ItemRejection } {
  if (keys === undefined) return { ok: true, keys: [] };
  if (!Array.isArray(keys) || keys.length > ITEM_FIELDS_MAX)
    return { ok: false, error: 'field_key_invalid' };
  for (const k of keys) {
    if (typeof k !== 'string' || !isValidFieldKey(k))
      return { ok: false, error: 'field_key_invalid' };
    if (k === 'title') return { ok: false, error: 'title_required' };
    if (k === 'votes') return { ok: false, error: 'votes_read_only' };
  }
  return { ok: true, keys: keys as string[] };
}
