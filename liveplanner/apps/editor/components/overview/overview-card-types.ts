// The Overview's card type tiles (docs/specs/026-plan/plan-overview.md "Card Types"): each type's fields, its cards
// and the Board tabs whose boards take it. Pure.
import { boardShowsType, isTrashed, type Item, type ItemTypeDef } from '@liveplanner/items';
import type { OverviewBoard } from './overview-boards';

export type CardTypeTileSummary = {
  type: ItemTypeDef;
  fields: number;
  cards: number;
  // The Board tabs whose boards take it, in tab order (one name per tab).
  usedOn: string[];
};

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

// "N Fields · N Cards".
export const cardTypeMeta = (t: CardTypeTileSummary): string =>
  `${plural(t.fields, 'Field', 'Fields')} · ${plural(t.cards, 'Card', 'Cards')}`;

// Where a type is used: "On A", "On A and B", "On A, B and 3 More", or null for no board at all.
export function usedOnLine(usedOn: readonly string[]): string | null {
  if (usedOn.length === 0) return null;
  if (usedOn.length === 1) return `On ${usedOn[0]}`;
  if (usedOn.length === 2) return `On ${usedOn[0]} and ${usedOn[1]}`;
  return `On ${usedOn[0]}, ${usedOn[1]} and ${usedOn.length - 2} More`;
}

export function cardTypeTilesOf(
  types: readonly ItemTypeDef[],
  items: Iterable<Item>,
  boards: readonly OverviewBoard[],
): CardTypeTileSummary[] {
  const counts = new Map<string, number>();
  for (const it of items) {
    if (isTrashed(it)) continue;
    counts.set(it.type, (counts.get(it.type) ?? 0) + 1);
  }
  // An Archive board takes no new cards, so it is no place a type is used.
  const taking = boards.filter((b) => !b.setup.archive);
  return types.map((type) => {
    const usedOn: string[] = [];
    for (const b of taking)
      if (boardShowsType(b.setup, type.id, types) && !usedOn.includes(b.tabName))
        usedOn.push(b.tabName);
    return { type, fields: type.fields.length, cards: counts.get(type.id) ?? 0, usedOn };
  });
}
