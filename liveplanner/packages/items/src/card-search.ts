// Card Search (docs/specs/026-plan/plan-views.md "Card Search"): a view that lists the cards matching its filters,
// each a field and a value ("Card Type: Project", "State: Done", "Assignee: No assignee"), all of which a card must
// match. A field is a board's grouping (built in, or a lane field), and a value is one of its lanes, so values are
// named, ordered and matched exactly as a board's swimlanes are. What can be added narrows as filters are: only the
// fields the card types still in play offer, and only the values some still-matching card has.
import { builtInFieldLabel } from './built-in-field-labels';
import { liveCards } from './plan-views';
import {
  SWIMLANE_BY,
  cardsMatchingFilters,
  laneFieldsOf,
  laneGroups,
  statusLabel,
  swimlaneGroupingsFor,
  type SwimlaneBy,
} from './board';
import { PRIORITY_LABELS, isPriority } from './fields';
import { riskLabel } from './risk-fields';
import type { Item } from './item';
import { ITEM_TYPES, LEGACY_PARENT_GROUPING, type ItemTypeDef } from './item-types';

// One filter: a grouping (and its field for a lane field) and the lane a card must fall in ('' is the empty lane).
export interface CardSearchFilter {
  by: SwimlaneBy;
  field?: string;
  key: string;
}

// The most filters a search holds.
export const CARD_SEARCH_FILTERS_MAX = 8;
const KEY_MAX = 200;

export function isCardSearchFilter(v: unknown): v is CardSearchFilter {
  if (typeof v !== 'object' || v === null) return false;
  const f = v as Record<string, unknown>;
  // An old Parent filter stays valid (readCardSearchFilter reads it as the Parent field's).
  const legacy = f['by'] === LEGACY_PARENT_GROUPING;
  if (!legacy && (!(SWIMLANE_BY as readonly unknown[]).includes(f['by']) || f['by'] === 'none'))
    return false;
  if (
    f['field'] !== undefined &&
    (typeof f['field'] !== 'string' || !f['field'] || f['field'].length > 64)
  )
    return false;
  if (f['by'] === 'field' && typeof f['field'] !== 'string') return false;
  return typeof f['key'] === 'string' && f['key'].length <= KEY_MAX;
}

export function isCardSearchFilters(v: unknown): v is CardSearchFilter[] {
  return Array.isArray(v) && v.length <= CARD_SEARCH_FILTERS_MAX && v.every(isCardSearchFilter);
}

// A field a filter can be added on: its grouping, its field, and its name.
interface CardSearchField {
  by: SwimlaneBy;
  field?: string;
  label: string;
}

const GROUPING_LABELS: Partial<Record<SwimlaneBy, string>> = {
  type: 'Card Type',
  status: 'State',
  assignee: 'Assignee',
  priority: 'Priority',
};

const sameField = (a: { by: SwimlaneBy; field?: string | undefined }, b: typeof a) =>
  a.by === b.by && (a.by !== 'field' || a.field === b.field);

// The cards matching every filter.
export function searchCards(
  items: Iterable<Item>,
  filters: readonly CardSearchFilter[],
  types: readonly ItemTypeDef[] = ITEM_TYPES,
  statusNames?: ReadonlyMap<string, string>,
): Item[] {
  const cards = liveCards(items);
  if (filters.length === 0) return cards;
  return cardsMatchingFilters(
    cards,
    filters,
    new Map(cards.map((c) => [c.id, c])),
    types,
    statusNames,
  );
}

// The card types in play: the matching cards' types (every type when none match), so a field none of them offer is
// not offered.
function typesInPlay(cards: readonly Item[], types: readonly ItemTypeDef[]): ItemTypeDef[] {
  const ids = new Set(cards.map((c) => c.type));
  const inPlay = types.filter((t) => ids.has(t.id));
  return inPlay.length > 0 ? inPlay : [...types];
}

// The fields a filter can still be added on: the groupings and lane fields the types in play offer, less the
// fields already filtered.
export function searchFields(
  matching: readonly Item[],
  filters: readonly CardSearchFilter[],
  types: readonly ItemTypeDef[] = ITEM_TYPES,
): CardSearchField[] {
  const inPlay = typesInPlay(matching, types);
  const out: CardSearchField[] = [];
  // Card Type is always offered while there are cards, even all of one type (a board's swimlanes skip it then):
  // naming it is worth it (Setup Sheet's card table takes its new rows' type from it).
  const offered = new Set<SwimlaneBy>(swimlaneGroupingsFor(inPlay));
  if (matching.length) offered.add('type');
  else offered.delete('type');
  for (const by of SWIMLANE_BY.filter((b) => offered.has(b))) {
    if (by === 'none') continue;
    const own = GROUPING_LABELS[by] ?? by;
    // Assignee and Priority are built-in fields: named as the matching cards' types name them.
    out.push({
      by,
      label: by === 'assignee' || by === 'priority' ? builtInFieldLabel(by, inPlay, own) : own,
    });
  }
  for (const f of laneFieldsOf(inPlay, true))
    out.push({ by: 'field', field: f.id, label: f.label });
  return out.filter((f) => !filters.some((x) => sameField(x, f)));
}

// The values a field can take among the matching cards, in a board's lane order, each with how many cards have it.
// A parent or a linked card is looked up among `items` (every card, as searchCards does), not only the matching ones.
export function searchValues(
  matching: readonly Item[],
  field: { by: SwimlaneBy; field?: string | undefined },
  types: readonly ItemTypeDef[] = ITEM_TYPES,
  statusNames?: ReadonlyMap<string, string>,
  items: Iterable<Item> = matching,
): { key: string; label: string; count: number }[] {
  const all = new Map(liveCards(items).map((c) => [c.id, c]));
  const groups = laneGroups(
    field.by,
    field.field,
    matching,
    all,
    types,
    statusNames,
    undefined,
    true,
  );
  const counts = new Map<string, number>();
  for (const keys of groups.lanesOfItem.values())
    for (const key of keys) counts.set(key, (counts.get(key) ?? 0) + 1);
  return groups.lanes.map((l) => ({ key: l.key, label: l.label, count: counts.get(l.key) ?? 0 }));
}

// A filter's chip: its field's name and its value's, as the lanes name them; a value no card has any more is named
// from its key as its lane would be ("State: Done", "Assignee: No assignee"), and a person's that no card names
// any more keeps its key.
export function searchFilterLabel(
  filter: CardSearchFilter,
  items: Iterable<Item>,
  types: readonly ItemTypeDef[] = ITEM_TYPES,
  statusNames?: ReadonlyMap<string, string>,
): { field: string; value: string } {
  const field =
    filter.by === 'field'
      ? (laneFieldsOf(types, true).find((f) => f.id === filter.field)?.label ?? filter.field ?? '')
      : (GROUPING_LABELS[filter.by] ?? filter.by);
  const cards = liveCards(items);
  const value = searchValues(cards, filter, types, statusNames, cards).find(
    (v) => v.key === filter.key,
  );
  return { field, value: value?.label ?? keyLabel(filter, types, statusNames) };
}

// A lane's name from its key alone (board.ts lanesOf): `s:` a state, `t:` a type, `p:` a priority, `f:` a field's
// value as JSON, '' the empty lane.
function keyLabel(
  filter: CardSearchFilter,
  types: readonly ItemTypeDef[],
  statusNames?: ReadonlyMap<string, string>,
): string {
  const { by, key } = filter;
  const f = by === 'field' ? laneFieldsOf(types, true).find((x) => x.id === filter.field) : null;
  if (key === '') {
    if (by === 'status') return 'No status';
    if (by === 'assignee') return 'No assignee';
    if (by === 'priority') return 'No priority';
    return f ? `No ${f.label}` : 'Empty';
  }
  const rest = key.slice(2);
  if (by === 'status' && key.startsWith('s:')) return statusLabel(rest, statusNames);
  if (by === 'type' && key.startsWith('t:')) return types.find((t) => t.id === rest)?.label ?? rest;
  if (by === 'priority' && key.startsWith('p:') && isPriority(rest)) return PRIORITY_LABELS[rest];
  if (by === 'field' && key.startsWith('f:') && !key.startsWith('f:p:')) {
    try {
      const v: unknown = JSON.parse(rest);
      if (typeof v === 'boolean') return v ? 'Yes' : 'No';
      // A Risk level by its name, "High" (item-types.md "Risk").
      if (f?.kind === 'risk' && riskLabel(v)) return riskLabel(v)!;
      if (typeof v === 'string' || typeof v === 'number') return String(v);
    } catch {
      // Not a value's key: named by the key, below.
    }
  }
  return key;
}

// The filter a press on one value of a category field makes (a Breakdown's or Donut's): the field and the row that
// value is, as the chips name them. A Person field's rows are keyed by person id, every other by the value itself.
export function fieldValueFilter(
  field: { id: string; kind: string },
  value: string,
): CardSearchFilter {
  return {
    by: 'field',
    field: field.id,
    key: field.kind === 'person' ? `f:p:${value}` : `f:${JSON.stringify(value)}`,
  };
}

// `filters` with `filter` toggled: that value off when already there, else on. A field that holds one value (a Choice)
// has its earlier value replaced, as two would match no card; one that holds several (`stack`: Labels, Multiple
// Choice) keeps them. Unchanged, at the cap, when it cannot fit.
export function toggleFieldFilter(
  filters: readonly CardSearchFilter[],
  filter: CardSearchFilter,
  stack = false,
): CardSearchFilter[] {
  const same = (a: CardSearchFilter) => a.by === filter.by && a.field === filter.field;
  if (filters.some((f) => same(f) && f.key === filter.key))
    return filters.filter((f) => !(same(f) && f.key === filter.key));
  const rest = stack ? [...filters] : filters.filter((f) => !same(f));
  return rest.length >= CARD_SEARCH_FILTERS_MAX ? [...filters] : [...rest, filter];
}
