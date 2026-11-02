// Fields that hold several values (docs/specs/026-plan/item-types.md "Holds Several"): a Person field's people or a
// Card field's cards, switched on by `multiple: true` on the field. One reading for both kinds, so every reader (the
// card panel, the card face, lanes, filters, notifying, Linked as, agents and CSV) treats a list the same way: a
// field holding several reads a single stored value as a list of one, and a field holding one reads a stored list as
// its first value, so turning the switch either way never rewrites a card. Pure.
import { isItemPerson, type Item, type ItemFieldValue, type ItemPerson } from './item';
import type { CustomFieldDef, CustomFieldKind } from './item-types';
import { FIELD_VALUES_MAX } from './limits';

// The kinds a field may hold several of.
export const holdsSeveralKind = (kind: CustomFieldKind): boolean =>
  kind === 'person' || kind === 'card';

// Whether a field holds several values: switched on, and of a kind that can.
export const holdsSeveral = (
  field: Pick<CustomFieldDef, 'kind' | 'multiple'> | undefined,
): boolean => !!field && field.multiple === true && holdsSeveralKind(field.kind);

// Every person a stored Person value holds, each once by id: a list's, a single person as one, nothing else.
export function storedPeople(value: unknown): ItemPerson[] {
  const list = Array.isArray(value) ? value : [value];
  const out: ItemPerson[] = [];
  for (const p of list) if (isItemPerson(p) && !out.some((x) => x.id === p.id)) out.push(p);
  return out;
}

// Every card id a stored Card value holds, each once: a list's, a single id as one, nothing else.
export function storedCardIds(value: unknown): string[] {
  const list = Array.isArray(value) ? value : [value];
  const out: string[] = [];
  for (const id of list) if (typeof id === 'string' && id && !out.includes(id)) out.push(id);
  return out;
}

type SeveralField = Pick<CustomFieldDef, 'kind' | 'multiple'> | undefined;

// The people a Person field shows: all of them when it holds several, else the first (the Assignee, no def, holds
// one).
export function fieldPeople(field: SeveralField, value: unknown): ItemPerson[] {
  const all = storedPeople(value);
  return holdsSeveral(field) ? all : all.slice(0, 1);
}

// The card ids a Card field links to: all of them when it holds several, else the first (Parent holds one).
export function fieldCardIds(field: SeveralField, value: unknown): string[] {
  const all = storedCardIds(value);
  return holdsSeveral(field) ? all : all.slice(0, 1);
}

// Every card a card's field links to, by id, in order: the one reader a rollup or lookup reads linked cards through
// (docs/specs/026-plan/item-types.md "Holds Several").
export function linkedCardIds(
  item: Pick<Item, 'fields'>,
  field: Pick<CustomFieldDef, 'id' | 'kind' | 'multiple'>,
): string[] {
  return field.kind === 'card' ? fieldCardIds(field, item.fields[field.id]) : [];
}

// The value to store for a field from its values: a list (at most FIELD_VALUES_MAX) when it holds several, else the
// first; undefined (clear the field) when there are none.
export function severalValue<T extends ItemFieldValue>(
  field: SeveralField,
  values: readonly T[],
): ItemFieldValue | undefined {
  if (values.length === 0) return undefined;
  return holdsSeveral(field) ? values.slice(0, FIELD_VALUES_MAX) : values[0];
}

// `values` with `value` added at the end, or taken out when it is there already (a pick in the list toggles), by
// `keyOf`. Adding past FIELD_VALUES_MAX leaves the list as it was.
export function toggledValues<T>(values: readonly T[], value: T, keyOf: (v: T) => string): T[] {
  const key = keyOf(value);
  if (values.some((v) => keyOf(v) === key)) return values.filter((v) => keyOf(v) !== key);
  return values.length >= FIELD_VALUES_MAX ? [...values] : [...values, value];
}

// A card dragged from one value's row into another's (docs/specs/026-plan/plan-board.md "Swimlanes by a field"):
// `from` swapped for `to` in place, its others kept; when it holds `to` already, `from` just goes. No `from` (a card
// from No {Field}, or from another board) adds `to`.
export function swappedValues<T>(
  values: readonly T[],
  from: T | undefined,
  to: T,
  keyOf: (v: T) => string,
): T[] {
  const toKey = keyOf(to);
  const fromKey = from === undefined ? undefined : keyOf(from);
  if (fromKey === toKey) return [...values];
  const has = values.some((v) => keyOf(v) === toKey);
  const out: T[] = [];
  let placed = has;
  for (const v of values) {
    if (keyOf(v) !== fromKey) out.push(v);
    else if (!placed) {
      out.push(to);
      placed = true;
    }
  }
  if (!placed) out.push(to);
  return out.slice(0, FIELD_VALUES_MAX);
}

export const personKey = (p: ItemPerson): string => p.id;
export const cardKey = (id: string): string => id;
