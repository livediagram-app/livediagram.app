// The Overview's card type tiles (docs/specs/026-plan/plan-overview.md "Card Types"): each type's fields, a sample of
// its cards, how many it has and in which statuses, how many are overdue, and the Board tabs whose boards take it.
// Pure, and one pass over the cards for every type together.
import {
  boardShowsType,
  isTrashed,
  itemStatus,
  statusLabel,
  statusPhasesOf,
  type Item,
  type ItemTypeDef,
  type StatusPhase,
} from '@liveplanner/items';
import type { OverviewBoard } from './overview-boards';

// Field chips before "+N More".
export const TYPE_FIELDS_SHOWN = 5;
// Board links before "+N More".
export const TYPE_BOARDS_SHOWN = 3;

export type TypeBoardLink = { tabId: string; tabName: string; elementId: string };

export type TypeStatusShare = {
  status: string;
  // Its column's name ("No Status" for a card with none).
  label: string;
  count: number;
  // The column's own colour, when it has one.
  color: string | null;
  phase: StatusPhase;
};

export type CardTypeTileSummary = {
  type: ItemTypeDef;
  fields: number;
  cards: number;
  // The Board tabs whose boards take it, in tab order (one per tab).
  usedOn: TypeBoardLink[];
  // The boards that could take it but do not (they name their types and not this one): Add to a Board's choices.
  canAddTo: TypeBoardLink[];
  // Its live cards by status, in the boards' column order, then any status no board names.
  byStatus: TypeStatusShare[];
  // Cards past their Due Date and not in a done column; null for a type with no Due Date field.
  overdue: number | null;
  // The card most recently changed, drawn as its sample; null for a type with no cards.
  sample: Item | null;
};

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

// "N Fields · N Cards".
export const cardTypeMeta = (t: CardTypeTileSummary): string =>
  `${plural(t.fields, 'Field', 'Fields')} · ${plural(t.cards, 'Card', 'Cards')}`;

// "N Cards", "1 Card", "No Cards Yet".
export const cardCountLine = (n: number): string =>
  n === 0 ? 'No Cards Yet' : plural(n, 'Card', 'Cards');

// Where a type is used: "On A", "On A and B", "On A, B and 3 More", or null for no board at all.
export function usedOnLine(
  usedOn: readonly { tabName: string }[] | readonly string[],
): string | null {
  const names = usedOn.map((u) => (typeof u === 'string' ? u : u.tabName));
  if (names.length === 0) return null;
  if (names.length === 1) return `On ${names[0]}`;
  if (names.length === 2) return `On ${names[0]} and ${names[1]}`;
  return `On ${names[0]}, ${names[1]} and ${names.length - 2} More`;
}

// The local calendar day, "2026-11-04", as Due Dates are stored.
export function todayKey(now = Date.now()): string {
  const d = new Date(now);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

type Tally = { cards: number; overdue: number; statuses: Map<string, number>; sample: Item | null };

export function cardTypeTilesOf(
  types: readonly ItemTypeDef[],
  items: Iterable<Item>,
  boards: readonly OverviewBoard[],
  opts: { statusNames?: ReadonlyMap<string, string>; today?: string } = {},
): CardTypeTileSummary[] {
  const today = opts.today ?? todayKey();
  const phases = statusPhasesOf(boards.map((b) => b.setup));
  const tallies = new Map<string, Tally>();
  for (const it of items) {
    if (isTrashed(it)) continue;
    let t = tallies.get(it.type);
    if (!t) {
      t = { cards: 0, overdue: 0, statuses: new Map(), sample: null };
      tallies.set(it.type, t);
    }
    t.cards += 1;
    const status = itemStatus(it) ?? '';
    t.statuses.set(status, (t.statuses.get(status) ?? 0) + 1);
    const due = it.fields['due'];
    if (typeof due === 'string' && due && due < today && phases.get(status) !== 'done')
      t.overdue += 1;
    if (!t.sample || it.updatedAt > t.sample.updatedAt) t.sample = it;
  }
  // Each status's column, the first board naming it: its name, colour and order.
  const columns = new Map<string, { name: string; color: string | null; order: number }>();
  for (const b of boards)
    for (const c of b.setup.columns)
      if (!columns.has(c.status))
        columns.set(c.status, { name: c.name, color: c.color ?? null, order: columns.size });
  // An Archive board takes no new cards, so it is no place a type is used.
  const taking = boards.filter((b) => !b.setup.archive);
  return types.map((type) => {
    const usedOn: TypeBoardLink[] = [];
    const canAddTo: TypeBoardLink[] = [];
    for (const b of taking) {
      const link = { tabId: b.tabId, tabName: b.tabName, elementId: b.elementId };
      if (boardShowsType(b.setup, type.id, types)) {
        if (!usedOn.some((u) => u.tabId === b.tabId)) usedOn.push(link);
      } else if (b.setup.addTypes && !canAddTo.some((u) => u.tabId === b.tabId))
        canAddTo.push(link);
    }
    const tally = tallies.get(type.id);
    const byStatus = [...(tally?.statuses ?? new Map<string, number>())]
      .map(([status, count]): TypeStatusShare => {
        const col = columns.get(status);
        return {
          status,
          label: status ? (col?.name ?? statusLabel(status, opts.statusNames)) : 'No Status',
          count,
          color: col?.color ?? null,
          phase: phases.get(status) ?? 'todo',
        };
      })
      .sort(
        (a, b) =>
          (columns.get(a.status)?.order ?? Infinity) - (columns.get(b.status)?.order ?? Infinity) ||
          (a.status < b.status ? -1 : a.status > b.status ? 1 : 0),
      );
    return {
      type,
      fields: type.fields.length,
      cards: tally?.cards ?? 0,
      usedOn,
      canAddTo,
      byStatus,
      overdue: type.fields.includes('due') ? (tally?.overdue ?? 0) : null,
      sample: tally?.sample ?? null,
    };
  });
}
