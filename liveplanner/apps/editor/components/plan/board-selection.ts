// Several cards picked on one board to change together (docs/specs/026-plan/plan-board.md "Several cards at once";
// blueprint plan-board.md): pure functions of the board as drawn. The selection is a person's own and never saved.
import type { BoardProjection, ItemMove } from '@liveplanner/items';
import type { ItemMoveOf } from '@liveplanner/items';

export type BoardSelection = {
  ids: ReadonlySet<string>;
  // The card a Shift-click's range starts from: the last one picked.
  anchor: string | null;
  // Select mode (Select in a card's menu): a plain click or tap picks a card rather than opening it.
  mode: boolean;
};

export const NO_SELECTION: BoardSelection = { ids: new Set(), anchor: null, mode: false };

// Every card the board draws, in reading order: columns left to right, rows top to bottom, then place in the cell.
function readingOrder(p: BoardProjection): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const c of p.columns)
    for (const l of c.lanes)
      for (const it of l.items)
        if (!seen.has(it.id)) {
          seen.add(it.id);
          out.push(it.id);
        }
  return out;
}

// The selected cards the board still draws, in reading order.
export function selectionOrder(p: BoardProjection, ids: ReadonlySet<string>): string[] {
  if (ids.size === 0) return [];
  return readingOrder(p).filter((id) => ids.has(id));
}

// The selection with the cards the board no longer draws taken out (moved off, trashed, filtered out, deleted); the
// same object when nothing went. Select mode ends with the last card.
export function selectionShown(p: BoardProjection, sel: BoardSelection): BoardSelection {
  if (sel.ids.size === 0) return sel.mode ? NO_SELECTION : sel;
  const drawn = new Set(readingOrder(p));
  const kept = [...sel.ids].filter((id) => drawn.has(id));
  if (kept.length === sel.ids.size) return sel;
  if (kept.length === 0) return NO_SELECTION;
  return {
    ids: new Set(kept),
    anchor: sel.anchor && drawn.has(sel.anchor) ? sel.anchor : null,
    mode: sel.mode,
  };
}

// One card added to the selection or taken out; it becomes the next range's start.
export function toggleCard(sel: BoardSelection, id: string): BoardSelection {
  const ids = new Set(sel.ids);
  if (ids.has(id)) ids.delete(id);
  else ids.add(id);
  if (ids.size === 0) return NO_SELECTION;
  return { ids, anchor: id, mode: sel.mode };
}

// The column a card is drawn in (its index), or -1.
function columnOf(p: BoardProjection, id: string): number {
  return p.columns.findIndex((c) => c.lanes.some((l) => l.items.some((i) => i.id === id)));
}

// The cards from the anchor to `id` within one column (its rows' cells read top to bottom), both ends included; a card
// in another column, or with no anchor, is just that card.
export function rangeInColumn(p: BoardProjection, anchor: string | null, id: string): string[] {
  const col = columnOf(p, id);
  if (!anchor || col < 0 || columnOf(p, anchor) !== col) return [id];
  const flat = p.columns[col]!.lanes.flatMap((l) => l.items.map((i) => i.id));
  const a = flat.indexOf(anchor);
  const b = flat.indexOf(id);
  const [from, to] = a <= b ? [a, b] : [b, a];
  return [...new Set(flat.slice(from, to + 1))];
}

// A Shift-click: the range added to the selection; the clicked card becomes the next range's start.
export function selectRange(p: BoardProjection, sel: BoardSelection, id: string): BoardSelection {
  const ids = new Set(sel.ids);
  for (const r of rangeInColumn(p, sel.anchor, id)) ids.add(r);
  return { ids, anchor: id, mode: sel.mode };
}

// Shift+Left/Right on a selected card: every selected card a column left or right of its own (one at the board's edge
// stays), each landing at the end of its new column in the order the cards sat. A sorted board puts them where its
// sort does.
export function groupColumnMoves(
  p: BoardProjection,
  ordered: readonly string[],
  step: -1 | 1,
): ItemMoveOf[] {
  const out: ItemMoveOf[] = [];
  // The last card placed in each target column, so the next one lands after it.
  const lastIn = new Map<string, string>();
  for (const id of ordered) {
    const col = columnOf(p, id);
    const target = p.columns[col + step];
    if (col < 0 || !target) continue;
    const status = target.column.status;
    const prev = lastIn.get(status);
    const move: ItemMove = prev ? { status, after: prev } : { status, before: null };
    out.push({ id, move });
    lastIn.set(status, id);
  }
  return out;
}

// "3 cards selected".
export function selectionCountLabel(n: number): string {
  return `${n} ${n === 1 ? 'card' : 'cards'} selected`;
}
