// A custom field's type changed in place (docs/specs/026-plan/item-types.md "Edit Field"): which changes are refused
// and why, each card's value as the new type holds it (kept, rewritten, cut down to what fits, or cleared), and one
// pass over a plan's cards counting them and making the patches that write them. The field keeps its id. Pure.
import { customValueOfText } from './board-csv';
import { customFieldText } from './card-text';
import { instantOnDay, readInstant } from './date-time-fields';
import { readRange } from './date-range-fields';
import { dayNumber } from './plan-view-dates';
import {
  isItemPerson,
  type Item,
  type ItemFieldValue,
  type ItemPatch,
  type ItemPerson,
} from './item';
import type { CustomFieldDef, CustomFieldKind, ItemTypeDef } from './item-types';
import { inheritingTypesOf } from './type-inheritance';
import { ITEM_LABELS_MAX, ITEM_LABEL_MAX, ITEM_UNKNOWN_STRING_MAX } from './limits';
import { richFieldOf } from './rich-text-field';
import { RISKS, RISK_LABELS, riskLabel, riskOf } from './risk-fields';
import { holdsSeveral, storedCardIds, storedPeople } from './several-values';
import { holdsSeveralImages, storedImageIds } from './image-values';
import type { ItemPatchOf } from './store';
import { CUSTOM_CHOICE_OPTIONS_MAX, CUSTOM_CHOICE_OPTION_MAX } from './type-catalogue';

// What a field is, as far as its values go: its kind and the settings that change what it holds.
export type KindShape = Pick<CustomFieldDef, 'kind'> &
  Partial<
    Pick<
      CustomFieldDef,
      'multiple' | 'blocks' | 'timeSpent' | 'withTime' | 'calculation' | 'options' | 'scale'
    >
  >;

// The context a value is read in: the plan's people (a name read as a person), its cards (a link read as a title)
// and the viewer's zone (a day given its 9:00).
export interface KindChangeContext {
  people?: readonly ItemPerson[];
  items?: ReadonlyMap<string, Item>;
  tz?: string;
}

const DAY_MS = 86_400_000;
const isoOfDay = (day: number) => new Date(day * DAY_MS).toISOString().slice(0, 10);

// The kinds that hold no value a card can be given another way: their values are never converted, so no field
// changes to or from them. Each with why, as the gallery's tooltip says it.
const KEPT_APART: Partial<Record<CustomFieldKind, string>> = {
  comments: 'Comments hold threads, not values, so no field changes to or from them.',
  votes: 'Votes are counted by a session vote, so no field changes to or from them.',
  image: 'An Image holds an uploaded picture, so no field changes to or from it.',
  checklist: 'A Checklist holds rows to tick, so no field changes to or from it.',
};
const TIME_TRACKING = 'Time Tracking keeps logged time, so no field changes to or from it.';
const WORKED_OUT =
  'Worked out, never typed: a field with values can’t become one, nor one become a field with values.';
const NO_CARD = 'Only a card link can become a Link to Card field: other values can’t name a card.';

const isTracking = (f: KindShape) => f.kind === 'duration' && f.timeSpent === true;

/**
 * Why a field of shape `from` can't change to `to`, or null when it can (the same type always can). A Calculated
 * field becomes another worked-out one (Formula, Rollup, Lookup), as none holds a value.
 */
export function kindChangeRefusal(from: KindShape, to: KindShape): string | null {
  const apart = KEPT_APART[to.kind] ?? KEPT_APART[from.kind];
  if (apart && from.kind !== to.kind) return apart;
  if (isTracking(from) !== isTracking(to)) return TIME_TRACKING;
  if ((from.kind === 'calculated') !== (to.kind === 'calculated')) return WORKED_OUT;
  if (to.kind === 'card' && from.kind !== 'card') return NO_CARD;
  return null;
}

// A value's outcome: kept as stored, rewritten (`trimmed` when part of it could not come: a second person, a time),
// or cleared (nothing of it fits the new type).
export type ValueChange =
  | { kind: 'kept' }
  | { kind: 'rewritten'; value: ItemFieldValue; trimmed: boolean }
  | { kind: 'cleared' };

const KEPT: ValueChange = { kind: 'kept' };
const CLEARED: ValueChange = { kind: 'cleared' };
const rewritten = (value: ItemFieldValue | undefined, trimmed = false): ValueChange =>
  value === undefined || value === null ? CLEARED : { kind: 'rewritten', value, trimmed };

/** A Long Text's lines run together on one line: each line break, with the spaces around it, becomes one space.
 *  Linear, line by line (a `\s*\n\s*` pattern backtracks on long runs of spaces). */
export function oneLine(text: string): string {
  const lines = text.split('\n');
  if (lines.length === 1) return text;
  const middle = lines
    .slice(1, -1)
    .map((l) => l.trim())
    .filter(Boolean);
  return [lines[0]!.trimEnd(), ...middle, lines[lines.length - 1]!.trimStart()].join(' ');
}

/** Whether a stored value holds anything (an empty list or text holds nothing). */
export function holdsValue(value: ItemFieldValue | undefined): boolean {
  if (value === undefined || value === null || value === '') return false;
  return !Array.isArray(value) || value.length > 0;
}

const asDef = (f: KindShape): CustomFieldDef => ({ id: '', label: '', ...f });
const lower = (s: string) => s.trim().toLowerCase();

// A value's parts, each a line of text: a list's items (options, labels, people's names), else the value as one.
// The kinds whose value is a list of items, each one part.
const LIST_KINDS: ReadonlySet<CustomFieldKind> = new Set(['multichoice', 'labels', 'person']);

// Labels from a list's items, one each, as a Labels field keeps them: trimmed, cut to ITEM_LABEL_MAX, no repeats,
// at most ITEM_LABELS_MAX.
function listLabels(parts: readonly string[]): string[] | undefined {
  const out: string[] = [];
  for (const part of parts) {
    const l = part.trim().slice(0, ITEM_LABEL_MAX).trim();
    if (l && !out.includes(l) && out.length < ITEM_LABELS_MAX) out.push(l);
  }
  return out.length ? out : undefined;
}

function partsOf(from: KindShape, value: ItemFieldValue, ctx: KindChangeContext): string[] {
  switch (from.kind) {
    case 'multichoice':
    case 'labels':
      return (Array.isArray(value) ? value : [value]).filter(
        (v): v is string => typeof v === 'string' && v.trim() !== '',
      );
    case 'person':
      return storedPeople(value)
        .map((p) => p.name)
        .filter(Boolean);
    default: {
      const text = textOf(from, value, ctx);
      return text ? [text] : [];
    }
  }
}

// A value as text a person would write it, and an import reads back: numbers plain ("12500", "90" minutes), a
// link whole, a checkbox Yes or No, a list joined by commas, a moment and a range as the card shows them.
function textOf(from: KindShape, value: ItemFieldValue, ctx: KindChangeContext): string | null {
  if (typeof value === 'number') return String(value);
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  switch (from.kind) {
    case 'multichoice':
    case 'labels':
    case 'person':
      return partsOf(from, value, ctx).join(', ') || null;
    case 'datetime':
    case 'daterange':
    case 'card':
      return customFieldText(asDef(from), value, ctx.items);
    // A level as its name, "High", so a Choice or a text keeps it as a person reads it.
    case 'risk':
      return riskLabel(value);
    default:
      return typeof value === 'string' ? value : null;
  }
}

const DATE_KINDS: ReadonlySet<CustomFieldKind> = new Set(['date', 'datetime', 'daterange']);

// A date-kind value moved to another date kind (or its range to or from Include Time): a day takes 9:00 in the
// viewer's zone, a moment keeps its day (dropping the time), a range keeps its start for one end.
function dateChange(
  from: KindShape,
  to: KindShape,
  value: ItemFieldValue,
  tz: string | undefined,
): ValueChange {
  const range = from.kind === 'daterange' ? readRange(value) : undefined;
  // The moment or day it starts at, and whether it carried a time and a second end.
  const start = range ? range.start : typeof value === 'string' ? value : undefined;
  if (!start) return CLEARED;
  const timed = readInstant(start) !== undefined;
  const dayOfEnd = (end: string) => {
    const d = dayNumber(end, tz);
    return d === undefined ? undefined : isoOfDay(d);
  };
  const instantOf = (end: string) => {
    if (readInstant(end)) return end;
    const d = dayNumber(end, tz);
    return d === undefined ? undefined : instantOnDay(undefined, d, tz);
  };
  const toTimed = to.kind === 'datetime' || (to.kind === 'daterange' && to.withTime === true);
  const endOf = (end: string) => (toTimed ? instantOf(end) : dayOfEnd(end));
  const lostTime = timed && !toTimed;
  if (to.kind === 'daterange') {
    const a = endOf(start);
    const b = endOf(range ? range.end : start);
    return a && b ? rewritten([a, b], lostTime) : CLEARED;
  }
  // One end from a range: its start (and whatever else it had is lost).
  return rewritten(endOf(start), lostTime || (!!range && range.end !== range.start));
}

/** A stored value as a field changed from `from` to `to` holds it. */
export function changedValue(
  from: KindShape,
  to: KindShape,
  value: ItemFieldValue,
  ctx: KindChangeContext = {},
): ValueChange {
  if (from.kind === to.kind) {
    // One person or card from several: the first, the rest lost. Several from one reads one as a list: kept.
    if ((to.kind === 'person' || to.kind === 'card') && holdsSeveral(from) && !holdsSeveral(to)) {
      const all = to.kind === 'person' ? storedPeople(value) : storedCardIds(value);
      return all.length > 1 ? rewritten(all[0], true) : KEPT;
    }
    // One picture from Several Images: the first, the rest leave the card (item-types.md "Image fields").
    if (to.kind === 'image' && holdsSeveralImages(from) && !holdsSeveralImages(to)) {
      const all = storedImageIds(value);
      return all.length > 1 ? rewritten(all[0], true) : KEPT;
    }
    if (to.kind === 'daterange' && (from.withTime === true) !== (to.withTime === true))
      return dateChange(from, to, value, ctx.tz);
    return KEPT;
  }
  if (DATE_KINDS.has(from.kind) && DATE_KINDS.has(to.kind))
    return dateChange(from, to, value, ctx.tz);
  const parts = partsOf(from, value, ctx);
  if (parts.length === 0) return CLEARED;
  switch (to.kind) {
    case 'text':
    case 'longtext': {
      const text = textOf(from, value, ctx) ?? '';
      // One line on a Text field: a Long Text's lines run together.
      const line = to.kind === 'text' ? oneLine(text) : text;
      return rewritten(line.slice(0, ITEM_UNKNOWN_STRING_MAX) || undefined);
    }
    case 'choice': {
      // The first part that is one of its options; anything else it held is lost.
      const at = parts.findIndex((p) => to.options?.some((o) => lower(o) === lower(p)));
      const option = at < 0 ? undefined : to.options!.find((o) => lower(o) === lower(parts[at]!));
      return rewritten(option, parts.length > 1);
    }
    case 'multichoice': {
      const picks = (to.options ?? []).filter((o) => parts.some((p) => lower(p) === lower(o)));
      return rewritten(picks.length ? picks : undefined, picks.length < parts.length);
    }
    // The first part that names a level, in any case; anything else it held is lost (item-types.md "Risk").
    case 'risk': {
      const level = parts.map(riskOf).find((r) => r !== undefined);
      return rewritten(level, parts.length > 1);
    }
    case 'labels': {
      // A list's items are a label each, whatever they hold ("Yes, with notes", "Lopez, Ana"); only a text is read as
      // a line of labels split at its commas.
      const labels = LIST_KINDS.has(from.kind)
        ? listLabels(parts)
        : customValueOfText(asDef(to), parts.join(','), ctx.people ?? []);
      return rewritten(labels, Array.isArray(labels) && labels.length < parts.length);
    }
    case 'person': {
      const people = ctx.people ?? [];
      // A line of names ("Sam, Ana") names several, as an import reads one.
      const names =
        parts.length === 1 && holdsSeveral(to)
          ? parts[0]!
              .split(',')
              .map((p) => p.trim())
              .filter(Boolean)
          : parts;
      const found = names
        .map((name) => people.find((p) => lower(p.name) === lower(name)))
        .filter((p): p is ItemPerson => isItemPerson(p));
      if (found.length === 0) return CLEARED;
      return holdsSeveral(to)
        ? rewritten(found, found.length < names.length)
        : rewritten(found[0], names.length > 1);
    }
    default: {
      const text = parts.length > 1 ? parts.join(', ') : parts[0]!;
      return rewritten(customValueOfText(asDef(to), text, ctx.people ?? []));
    }
  }
}

/**
 * The options a field turned into a Choice or Multiple Choice starts with: its options when it had them, then each
 * distinct value its cards hold (each list's items one by one), in the order first met, up to the most a field
 * takes. Empty for any other target.
 */
export function optionsFromValues(
  from: KindShape,
  values: Iterable<ItemFieldValue>,
  ctx: KindChangeContext = {},
): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const add = (o: string) => {
    const t = o.trim().slice(0, CUSTOM_CHOICE_OPTION_MAX).trim();
    if (!t || seen.has(lower(t)) || out.length >= CUSTOM_CHOICE_OPTIONS_MAX) return;
    seen.add(lower(t));
    out.push(t);
  };
  // A Risk starts its Choice with the four levels, in order (item-types.md "Risk").
  const first = from.kind === 'risk' ? RISKS.map((r) => RISK_LABELS[r]) : (from.options ?? []);
  for (const o of first) add(o);
  for (const v of values) {
    if (out.length >= CUSTOM_CHOICE_OPTIONS_MAX) break;
    if (holdsValue(v)) for (const p of partsOf(from, v, ctx)) add(p);
  }
  return out;
}

// The cards a type's field is on: the type's own and those of the types inheriting the field from it.
export type FieldCards = { field: string; typeIds: ReadonlySet<string> };

// How a stored value reads as its shape holds it: a built-in's own (a Priority's id read as its name,
// built-in-field-retype.ts); a custom field's as stored.
export type ValueReader = (raw: ItemFieldValue | undefined) => ItemFieldValue | undefined;

/** Each value a field holds on the plan's cards, in the plan's order (each read by `read`, when given). */
export function* fieldValues(
  items: Iterable<Item>,
  on: FieldCards,
  read?: ValueReader,
): Generator<ItemFieldValue> {
  for (const item of items) {
    if (!on.typeIds.has(item.type)) continue;
    const v = read ? read(item.fields[on.field]) : item.fields[on.field];
    if (holdsValue(v)) yield v!;
  }
}

// A built-in field becoming a custom one (built-in-field-retype.ts): its values move to `into` (a new field id), each
// read by `read` first, and leave the built-in's key.
export interface ValueMove {
  into: string;
  read?: ValueReader;
}

export interface KindChangeOutcome {
  // Cards holding a value in the field.
  held: number;
  // Of them, those whose value is kept in part (a first person, a day without its time) and those cleared.
  trimmed: number;
  cleared: number;
  // The writes that leave every card's value as the new type holds it (none when nothing changes).
  patches: ItemPatchOf[];
}

/**
 * One pass over the plan's cards: what a change from `from` to `to` does to the values of the field (`on`), and the
 * patches that make it. A Long Text's formatting goes with it when it becomes another type.
 */
export function fieldKindChange(
  from: KindShape,
  to: KindShape,
  items: Iterable<Item>,
  on: FieldCards,
  ctx: KindChangeContext = {},
  move?: ValueMove,
): KindChangeOutcome {
  const out: KindChangeOutcome = { held: 0, trimmed: 0, cleared: 0, patches: [] };
  const rich = richFieldOf(on.field);
  const dropRich = from.kind === 'longtext' && to.kind !== 'longtext';
  const seen = new Map<string, ValueChange>();
  // Moving: every value held leaves the old key, and what is kept lands under `into`.
  const into = move?.into ?? on.field;
  const leave = move ? [on.field] : [];
  for (const item of items) {
    if (!on.typeIds.has(item.type)) continue;
    const value = move?.read ? move.read(item.fields[on.field]) : item.fields[on.field];
    const hasRich = dropRich && item.fields[rich] !== undefined;
    if (!holdsValue(value)) {
      if (hasRich) out.patches.push({ id: item.id, patch: { clear: [rich] } });
      continue;
    }
    out.held += 1;
    // A text value (a day, a name, an option) is worked out once a pass, however many cards hold it.
    let made = typeof value === 'string' ? seen.get(value) : undefined;
    if (!made) {
      made = changedValue(from, to, value!, ctx);
      if (typeof value === 'string') seen.set(value, made);
    }
    // A value rewritten as it already was (Text to Long Text) is kept.
    const change =
      made.kind === 'rewritten' && JSON.stringify(made.value) === JSON.stringify(value)
        ? KEPT
        : made;
    const clear = [...leave, ...(hasRich ? [rich] : [])];
    if (change.kind === 'kept') {
      if (move) out.patches.push({ id: item.id, patch: { set: { [into]: value! }, clear } });
      else if (clear.length) out.patches.push({ id: item.id, patch: { clear } });
    } else if (change.kind === 'cleared') {
      out.cleared += 1;
      out.patches.push({ id: item.id, patch: { clear: move ? clear : [on.field, ...clear] } });
    } else {
      if (change.trimmed) out.trimmed += 1;
      out.patches.push({
        id: item.id,
        patch: { set: { [into]: change.value }, ...(clear.length ? { clear } : {}) },
      });
    }
  }
  return out;
}

/** Whether a change from `from` to `to` touches the cards' values at all. */
export function changesValues(from: KindShape, to: KindShape): boolean {
  if (from.kind !== to.kind) return true;
  if (from.kind === 'person' || from.kind === 'card')
    return holdsSeveral(from) && !holdsSeveral(to);
  if (from.kind === 'image') return holdsSeveralImages(from) && !holdsSeveralImages(to);
  return from.kind === 'daterange' && (from.withTime === true) !== (to.withTime === true);
}

/** The cards a type's field is on: the type's own, and those of each type inheriting it (the same field, by id). */
export function fieldCardsOf(
  typeId: string,
  field: string,
  types: readonly ItemTypeDef[],
): FieldCards {
  const typeIds = new Set([typeId]);
  for (const t of inheritingTypesOf(typeId, types))
    if (t.custom?.some((f) => f.id === field)) typeIds.add(t.id);
  return { field, typeIds };
}

/**
 * The writes a type's save makes to its cards (docs/specs/026-plan/item-types.md "Edit Field"): each custom field
 * kept by id whose type changed, its values as the new type holds them, one patch per card however many fields
 * changed on it. None when no field's values change.
 */
export function retypedValuePatches(
  before: ItemTypeDef,
  after: ItemTypeDef,
  types: readonly ItemTypeDef[],
  items: Iterable<Item>,
  ctx: KindChangeContext = {},
): ItemPatchOf[] {
  const byId = new Map<string, ItemPatch>();
  const list = [...items];
  for (const next of after.custom ?? []) {
    const was = before.custom?.find((f) => f.id === next.id);
    if (!was || !changesValues(was, next) || kindChangeRefusal(was, next)) continue;
    const out = fieldKindChange(was, next, list, fieldCardsOf(before.id, next.id, types), ctx);
    for (const { id, patch } of out.patches) {
      const into = byId.get(id) ?? {};
      if (patch.set) into.set = { ...into.set, ...patch.set };
      if (patch.clear) into.clear = [...(into.clear ?? []), ...patch.clear];
      byId.set(id, into);
    }
  }
  return [...byId].map(([id, patch]) => ({ id, patch }));
}
