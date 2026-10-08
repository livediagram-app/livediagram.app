// Card Search (docs/specs/026-plan/plan-views.md "Card Search"): a view that lists the cards matching its filters,
// each a field and a value ("Card Type: Project", "State: Done", "Assignee: No assignee"), all of which a card must
// match. A field is a board's grouping (built in, or a lane field), and a value is one of its lanes, so values are
// named, ordered and matched exactly as a board's swimlanes are. What can be added narrows as filters are: only the
// fields the card types still in play offer, and only the values some still-matching card has.
import { liveCards } from './plan-views';
import {
  SWIMLANE_BY,
  laneFieldsOf,
  laneGroups,
  swimlaneGroupingsFor,
  type SwimlaneBy,
} from './board';
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
export interface CardSearchField {
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
  let cards = liveCards(items);
  if (filters.length === 0) return cards;
  const all = new Map(cards.map((c) => [c.id, c]));
  for (const f of filters) {
    const groups = laneGroups(f.by, f.field, cards, all, types, statusNames);
    cards = cards.filter((c) => groups.laneOfItem.get(c.id) === f.key);
  }
  return cards;
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
  for (const by of swimlaneGroupingsFor(inPlay)) {
    if (by === 'none') continue;
    // Card Type is worth filtering while the matching cards hold more than one type.
    if (by === 'type' && new Set(matching.map((c) => c.type)).size < 2) continue;
    out.push({ by, label: GROUPING_LABELS[by] ?? by });
  }
  for (const f of laneFieldsOf(inPlay)) out.push({ by: 'field', field: f.id, label: f.label });
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
  const groups = laneGroups(field.by, field.field, matching, all, types, statusNames);
  const counts = new Map<string, number>();
  for (const key of groups.laneOfItem.values()) counts.set(key, (counts.get(key) ?? 0) + 1);
  return groups.lanes.map((l) => ({ key: l.key, label: l.label, count: counts.get(l.key) ?? 0 }));
}

// A filter's chip: its field's name and its value's, as the lanes name them; a value no card has any more keeps
// its key as its name.
export function searchFilterLabel(
  filter: CardSearchFilter,
  items: Iterable<Item>,
  types: readonly ItemTypeDef[] = ITEM_TYPES,
  statusNames?: ReadonlyMap<string, string>,
): { field: string; value: string } {
  const field =
    filter.by === 'field'
      ? (laneFieldsOf(types).find((f) => f.id === filter.field)?.label ?? filter.field ?? '')
      : (GROUPING_LABELS[filter.by] ?? filter.by);
  const cards = liveCards(items);
  const value = searchValues(cards, filter, types, statusNames, cards).find(
    (v) => v.key === filter.key,
  );
  return { field, value: value?.label ?? (filter.key || 'Empty') };
}
