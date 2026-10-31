// A card's history (docs/specs/026-plan/items.md "History", blueprint item-store.md "History"): what each write did
// to one card, as the plan keeps it beside the card and the card panel reads it. Pure: the changes a write made, the
// values kept of them, the grouping of quick runs by one person, and the shape a reader is answered with.

import {
  ARCHIVED_FIELD,
  STATUS_SINCE_FIELD,
  type Item,
  type ItemFieldValue,
  type ItemPerson,
} from './item';
import { EXAMPLE_FIELD, TRASHED_FROM_FIELD, TRASH_STATUS, isArchived, isFlagged } from './board';
import { isRichFieldKey, richFieldOf } from './rich-text-field';

// The newest entries a card keeps, and the oldest an entry may be: each write drops its card's entries past either.
export const ITEM_HISTORY_MAX = 200;
export const ITEM_HISTORY_MAX_AGE_MS = 180 * 24 * 60 * 60 * 1000;
// Quick changes by one person within this of the first of them read as one entry.
export const ITEM_HISTORY_GROUP_MS = 60_000;
// What a kept value may hold: a line's worth of text, a label list's worth of entries.
export const ITEM_HISTORY_VALUE_MAX = 80;
export const ITEM_HISTORY_LIST_MAX = 12;
const LIST_ENTRY_MAX = 40;
// The most changes one entry holds: a write changes a few fields, and this bounds the row.
export const ITEM_HISTORY_CHANGES_MAX = 16;

// A field's new value as history keeps it: a short scalar, or a short list of them.
export type ItemHistoryValue = string | number | boolean | (string | number | boolean)[];

export type ItemHistoryChange =
  | { kind: 'created'; status?: string }
  | { kind: 'moved'; from: string | null; to: string | null }
  | { kind: 'trashed' }
  | { kind: 'untrashed' }
  | { kind: 'archived' }
  | { kind: 'unarchived' }
  | { kind: 'flagged' }
  | { kind: 'unflagged' }
  | { kind: 'type'; from: string; to: string }
  // `value` absent: the field is named, its value not copied (a description, a checklist).
  | { kind: 'set'; field: string; value?: ItemHistoryValue }
  | { kind: 'cleared'; field: string };

// How an entry was made: by an agent (an API token), as an undo or redo, or from a form's response.
export type ItemHistoryTag = 'ai' | 'undo' | 'form';

// An entry as the plan stores it: its author as the card names them (a hashed id, a name, a colour).
export type StoredHistoryEntry = {
  at: number;
  by: ItemPerson;
  tag?: ItemHistoryTag;
  changes: ItemHistoryChange[];
};

// An entry as a reader is answered: the author by name and colour, and `mine` for the author themselves.
export type ItemHistoryEntry = {
  at: number;
  by: { name: string; color: string };
  mine?: true;
  tag?: ItemHistoryTag;
  changes: ItemHistoryChange[];
};

// Fields that are not a change a reader is asking about, or that read as another change (the status, the flags).
const SKIPPED = new Set([
  'status',
  // When the card reached its column: the move stamps it, so it reads as the move.
  STATUS_SINCE_FIELD,
  TRASHED_FROM_FIELD,
  ARCHIVED_FIELD,
  'flagged',
  'votes',
  'comments',
  EXAMPLE_FIELD,
]);
// Fields named, never copied: long text, and lists of rows. A field with formatting (a Long Text) is named too.
const NAMED_ONLY = new Set(['description', 'checklist']);

const cut = (s: string, max: number) => (s.length > max ? `${s.slice(0, max - 1)}…` : s);

// A field's value as history keeps it, or undefined when it is named, not copied.
export function historyValueOf(
  field: string,
  value: ItemFieldValue | undefined,
): ItemHistoryValue | undefined {
  if (NAMED_ONLY.has(field) || value === undefined || value === null) return undefined;
  if (typeof value === 'string') return cut(value, ITEM_HISTORY_VALUE_MAX);
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (Array.isArray(value)) {
    const scalars: (string | number | boolean)[] = [];
    for (const v of value) {
      if (typeof v === 'string') scalars.push(cut(v, LIST_ENTRY_MAX));
      else if (typeof v === 'number' || typeof v === 'boolean') scalars.push(v);
      else return undefined;
      if (scalars.length === ITEM_HISTORY_LIST_MAX) break;
    }
    return scalars;
  }
  // A person (an assignee, a Person field) by name alone: their id never reaches a reader.
  const name = (value as { name?: unknown }).name;
  return typeof name === 'string' ? cut(name, ITEM_HISTORY_VALUE_MAX) : undefined;
}

const isEmpty = (v: ItemFieldValue | undefined) =>
  v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0);

const same = (a: ItemFieldValue | undefined, b: ItemFieldValue | undefined) =>
  a === b || JSON.stringify(a) === JSON.stringify(b);

const statusOf = (item: Item): string | null =>
  typeof item.fields['status'] === 'string' ? item.fields['status'] : null;

// What one write did to a card: `before` is the card as it stood (null for a create), `after` as written. Empty when
// nothing a reader asks about changed (a card's place in its column alone, a tally's votes).
export function historyChangesOf(before: Item | null, after: Item): ItemHistoryChange[] {
  if (!before) {
    const status = statusOf(after);
    return [status ? { kind: 'created', status } : { kind: 'created' }];
  }
  const out: ItemHistoryChange[] = [];
  const from = statusOf(before);
  const to = statusOf(after);
  if (from !== to) {
    if (to === TRASH_STATUS) out.push({ kind: 'trashed' });
    else if (from === TRASH_STATUS) out.push({ kind: 'untrashed' });
    else out.push({ kind: 'moved', from, to });
  }
  if (isArchived(before) !== isArchived(after))
    out.push({ kind: isArchived(after) ? 'archived' : 'unarchived' });
  if (isFlagged(before) !== isFlagged(after))
    out.push({ kind: isFlagged(after) ? 'flagged' : 'unflagged' });
  if (before.type !== after.type) out.push({ kind: 'type', from: before.type, to: after.type });
  const keys = new Set([...Object.keys(before.fields), ...Object.keys(after.fields)]);
  // A field's formatting alone (`descriptionRich`, a Long Text's `<id>Rich`) reads as the field changing.
  const restyled = new Set<string>();
  for (const key of keys) {
    if (isRichFieldKey(key) && !same(before.fields[key], after.fields[key]))
      restyled.add(key.slice(0, -'Rich'.length));
  }
  for (const field of restyled) keys.add(field);
  for (const field of keys) {
    if (SKIPPED.has(field) || isRichFieldKey(field)) continue;
    const next = after.fields[field];
    if (same(before.fields[field], next) && !restyled.has(field)) continue;
    const rich = richFieldOf(field);
    if (isEmpty(next) && isEmpty(after.fields[rich])) {
      out.push({ kind: 'cleared', field });
      continue;
    }
    const formatted = after.fields[rich] !== undefined || before.fields[rich] !== undefined;
    const value = formatted ? undefined : historyValueOf(field, next);
    out.push(value === undefined ? { kind: 'set', field } : { kind: 'set', field, value });
  }
  return out.slice(0, ITEM_HISTORY_CHANGES_MAX);
}

// The key changes merge under when entries group.
function keyOf(c: ItemHistoryChange): string {
  switch (c.kind) {
    case 'created':
      return 'created';
    case 'moved':
    case 'trashed':
    case 'untrashed':
      return 'status';
    case 'archived':
    case 'unarchived':
      return 'archive';
    case 'flagged':
    case 'unflagged':
      return 'flag';
    case 'type':
      return 'type';
    case 'set':
    case 'cleared':
      return `field:${c.field}`;
  }
}

// `newer` merged into `older` under one key: the change that stands, or null when they cancel out.
function merged(older: ItemHistoryChange, newer: ItemHistoryChange): ItemHistoryChange | null {
  if (older.kind === 'moved' && newer.kind === 'moved') {
    return older.from === newer.to ? null : { kind: 'moved', from: older.from, to: newer.to };
  }
  if (older.kind === 'type' && newer.kind === 'type') {
    return older.from === newer.to ? null : { kind: 'type', from: older.from, to: newer.to };
  }
  const pairs: Record<string, string> = {
    trashed: 'untrashed',
    untrashed: 'trashed',
    archived: 'unarchived',
    unarchived: 'archived',
    flagged: 'unflagged',
    unflagged: 'flagged',
  };
  if (pairs[older.kind] === newer.kind) return null;
  return newer;
}

// One group's changes, oldest entry's first: each key once, at its newest, `created` first.
function mergeChanges(oldestFirst: readonly StoredHistoryEntry[]): ItemHistoryChange[] {
  const byKey = new Map<string, ItemHistoryChange | null>();
  for (const entry of oldestFirst) {
    for (const change of entry.changes) {
      const key = keyOf(change);
      const held = byKey.get(key);
      // A key that cancelled out starts again from the next change to it.
      byKey.set(key, held ? merged(held, change) : change);
    }
  }
  const out = [...byKey.values()].filter((c): c is ItemHistoryChange => c !== null);
  out.sort((a, b) => (a.kind === 'created' ? -1 : 0) - (b.kind === 'created' ? -1 : 0));
  return out;
}

// Entries newest first, grouped: an entry joins the group before it (in time) when the same person made it, with the
// same tag, within ITEM_HISTORY_GROUP_MS of the group's oldest entry. A group with nothing left after merging goes.
export function groupHistory(newestFirst: readonly StoredHistoryEntry[]): StoredHistoryEntry[] {
  const groups: StoredHistoryEntry[][] = [];
  // Walk oldest first, so a group's window is measured from its first entry.
  for (let i = newestFirst.length - 1; i >= 0; i -= 1) {
    const entry = newestFirst[i]!;
    const group = groups[groups.length - 1];
    const first = group?.[0];
    if (
      group &&
      first &&
      first.by.id === entry.by.id &&
      first.tag === entry.tag &&
      entry.at - first.at <= ITEM_HISTORY_GROUP_MS
    ) {
      group.push(entry);
    } else {
      groups.push([entry]);
    }
  }
  const out: StoredHistoryEntry[] = [];
  for (let g = groups.length - 1; g >= 0; g -= 1) {
    const group = groups[g]!;
    const changes = mergeChanges(group);
    if (changes.length === 0) continue;
    const newest = group[group.length - 1]!;
    out.push({ at: newest.at, by: newest.by, ...(newest.tag ? { tag: newest.tag } : {}), changes });
  }
  return out;
}

// Entries as a reader is answered (the comment redaction, items.md "Writes"): the author's name and colour, and
// `mine` where the reader wrote it; nobody else's id leaves.
export function historyForReader(
  entries: readonly StoredHistoryEntry[],
  readerId: string,
): ItemHistoryEntry[] {
  return entries.map((e) => ({
    at: e.at,
    by: { name: e.by.name, color: e.by.color },
    ...(e.by.id && e.by.id === readerId ? { mine: true as const } : {}),
    ...(e.tag ? { tag: e.tag } : {}),
    changes: e.changes,
  }));
}

const TAGS: readonly string[] = ['ai', 'undo', 'form'];
const CHANGE_KINDS = new Set([
  'created',
  'moved',
  'trashed',
  'untrashed',
  'archived',
  'unarchived',
  'flagged',
  'unflagged',
  'type',
  'set',
  'cleared',
]);

// A stored row read back, or null when it does not parse (a row from a later release, a hand edit).
export function readStoredHistory(row: {
  at: unknown;
  by: unknown;
  tag: unknown;
  changes: unknown;
}): StoredHistoryEntry | null {
  if (typeof row.at !== 'number' || typeof row.by !== 'string' || typeof row.changes !== 'string')
    return null;
  try {
    const by = JSON.parse(row.by) as Partial<ItemPerson>;
    const changes = JSON.parse(row.changes) as unknown;
    if (typeof by.name !== 'string' || typeof by.color !== 'string') return null;
    if (!Array.isArray(changes)) return null;
    const kept = changes.filter(
      (c): c is ItemHistoryChange =>
        !!c && typeof c === 'object' && CHANGE_KINDS.has((c as { kind?: string }).kind ?? ''),
    );
    const tag = typeof row.tag === 'string' && TAGS.includes(row.tag) ? row.tag : undefined;
    return {
      at: row.at,
      by: { id: typeof by.id === 'string' ? by.id : '', name: by.name, color: by.color },
      ...(tag ? { tag: tag as ItemHistoryTag } : {}),
      changes: kept,
    };
  } catch {
    return null;
  }
}
