// The statuses a board can still take as columns (docs/specs/026-plan/plan-board.md "The column picker"): every
// status the document knows that this board has no column for, one per name, with what picking it brings onto
// the board (how many of its cards this board would show, the boards that already use it, their colour).
import { boardShowsType, isArchived, isTrashed, statusLabel, type PlanBoardSetup } from './board';
import { itemStatus, type Item } from './item';
import { statusKey } from './status-names';

export type StatusPick = { status: string; name: string };

// A status the board lacks, as the column picker lists it.
export interface MissingStatus extends StatusPick {
  // The cards in it (out of the Trash and the Archive) of the types this board shows: what its column would hold.
  cards: number;
  // The titles of the boards that use it, in document order; empty when only cards (or a card type) know it.
  boards: string[];
  // The colour the first board using it gives its column, when any does.
  colour?: string;
}

// A board as the picker reads it: its title, the statuses its columns hold (in order) and their colours.
export interface StatusBoardSource {
  title: string;
  statuses: readonly string[];
  // Status id to colour, a Map so any status id (even 'constructor') reads only what was set.
  colours?: ReadonlyMap<string, string>;
}

// The statuses a column can be made for: those the document's boards name (status id to name, in document
// order, the open tab's first), then any a card is in (out of the Trash) that no board names, by name, then any
// a card type makes its cards in (its Default State) that nothing else names, in catalogue order. A status no
// board names reads as its id in Title Case. The same map back when there is nothing to add.
export function pickableStatuses(
  statusNames: ReadonlyMap<string, string>,
  items: Iterable<Item>,
  types: readonly { id: string; defaultStatus?: string | undefined }[] = [],
): ReadonlyMap<string, string> {
  const extra = new Map<string, string>();
  for (const it of items) {
    if (isTrashed(it)) continue;
    const s = itemStatus(it);
    if (s && !statusNames.has(s) && !extra.has(s)) extra.set(s, statusLabel(s));
  }
  const fromCards = [...extra].sort((a, b) => a[1].localeCompare(b[1]));
  const fromTypes: [string, string][] = [];
  for (const t of types) {
    const s = t.defaultStatus;
    if (!s || statusNames.has(s) || extra.has(s) || fromTypes.some(([x]) => x === s)) continue;
    fromTypes.push([s, statusLabel(s)]);
  }
  if (!fromCards.length && !fromTypes.length) return statusNames;
  return new Map([...statusNames, ...fromCards, ...fromTypes]);
}

// The statuses of `statusNames` (as pickableStatuses gives them) this board has no column for, one per name (the
// first status of a name wins), in that order.
export function missingStatuses(
  setup: Pick<PlanBoardSetup, 'columns'>,
  statusNames: ReadonlyMap<string, string>,
): StatusPick[] {
  const onBoard = new Set(setup.columns.map((c) => c.status));
  const boardKeys = new Set(setup.columns.map((c) => statusKey(c.name)));
  const seen = new Set<string>();
  const out: StatusPick[] = [];
  for (const [status, name] of statusNames) {
    const key = statusKey(name);
    if (!key || onBoard.has(status) || boardKeys.has(key) || seen.has(key)) continue;
    seen.add(key);
    out.push({ status, name });
  }
  return out;
}

// missingStatuses, each with its card count on this board (respecting its Card Types), the boards that use it and
// their colour. One pass over the cards and one over the boards: O(cards + columns).
export function missingBoardStatuses(
  setup: Pick<PlanBoardSetup, 'columns' | 'addTypes'>,
  statusNames: ReadonlyMap<string, string>,
  opts: {
    items?: Iterable<Item>;
    types?: readonly { id: string }[];
    boards?: readonly StatusBoardSource[];
  } = {},
): MissingStatus[] {
  const picks = missingStatuses(setup, statusNames);
  if (!picks.length) return [];
  const wanted = new Set(picks.map((p) => p.status));
  const counts = new Map<string, number>();
  for (const it of opts.items ?? []) {
    const s = itemStatus(it);
    if (!s || !wanted.has(s) || isTrashed(it) || isArchived(it)) continue;
    if (!boardShowsType(setup, it.type, opts.types)) continue;
    counts.set(s, (counts.get(s) ?? 0) + 1);
  }
  const boards = new Map<string, string[]>();
  const colours = new Map<string, string>();
  for (const b of opts.boards ?? []) {
    for (const s of b.statuses) {
      if (!wanted.has(s)) continue;
      const titles = boards.get(s) ?? [];
      const title = b.title.trim() || 'Untitled Board';
      if (!titles.includes(title)) titles.push(title);
      boards.set(s, titles);
      const colour = b.colours?.get(s);
      if (colour && !colours.has(s)) colours.set(s, colour);
    }
  }
  return picks.map((p) => {
    const colour = colours.get(p.status);
    return {
      ...p,
      cards: counts.get(p.status) ?? 0,
      boards: boards.get(p.status) ?? [],
      ...(colour ? { colour } : {}),
    };
  });
}
