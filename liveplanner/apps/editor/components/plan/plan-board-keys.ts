// A Plan board's keyboard (docs/specs/026-plan/plan-board.md "Keyboard"), as a pure function of the
// board as drawn: arrow keys move focus between cards, Shift+Left/Right moves the card a column,
// Shift+Up/Down moves it within its column, Enter opens, Delete moves it to the Trash, N adds to the column.
import { itemTitle, type BoardProjection, type ItemMove } from '@liveplanner/items';

type PlanKeyAction =
  | { kind: 'focus'; itemId: string }
  | { kind: 'move'; move: ItemMove; announce: string }
  | { kind: 'open' }
  // Shift+Up/Down on a sorted board: nothing moves, and the reason is announced.
  | { kind: 'refuse'; announce: string }
  // `focusAfter`: the card that takes keyboard focus once this one has gone, the next in its cell, else the one
  // before it, so a run of Deletes works down a column; a cell left empty hands it to the nearest card on the
  // board in reading order (columns, then lanes); null only when the board is left with no card.
  | { kind: 'trash'; focusAfter: string | null }
  | { kind: 'add'; status: string; laneKey: string }
  // Several cards at once (docs/specs/026-plan/plan-board.md "Several cards at once"): Shift+Space picks the focused
  // card or lets it go; with it among two or more selected, Shift+Left/Right moves them all a column and Delete trashes
  // them all.
  | { kind: 'select' }
  | { kind: 'moveGroup'; step: -1 | 1 }
  | { kind: 'trashGroup' };

// What the board's selection means for the focused card's keys.
type SelectionKeys = {
  // Whether this person may select (an Editor or a Participant, on a board that takes a selection).
  canSelect: boolean;
  // The focused card is one of two or more selected.
  grouped: boolean;
  // Whether this person may trash cards (an Editor).
  canRetire: boolean;
};

type Cell = { col: number; lane: number; index: number };

function locate(p: BoardProjection, itemId: string): Cell | null {
  for (const [col, c] of p.columns.entries())
    for (const [lane, l] of c.lanes.entries()) {
      const index = l.items.findIndex((i) => i.id === itemId);
      if (index >= 0) return { col, lane, index };
    }
  return null;
}

const cellItems = (p: BoardProjection, col: number, lane: number) =>
  p.columns[col]?.lanes[lane]?.items ?? [];

// Who takes focus once `itemId` has gone (see `focusAfter`).
function focusAfterTrash(p: BoardProjection, at: Cell): string | null {
  const items = cellItems(p, at.col, at.lane);
  const inCell = items[at.index + 1] ?? items[at.index - 1];
  if (inCell) return inCell.id;
  const flat = p.columns.flatMap((c) => c.lanes.flatMap((l) => l.items));
  const gone = items[at.index]!.id;
  const i = flat.findIndex((it) => it.id === gone);
  return (flat[i + 1] ?? flat[i - 1])?.id ?? null;
}

export function planBoardKey(
  p: BoardProjection,
  itemId: string,
  key: string,
  shift: boolean,
  canEdit: boolean,
  // A sorted board's first field ("Priority"), named when Shift+Up/Down cannot reorder.
  sortedBy?: string,
  selection?: SelectionKeys,
): PlanKeyAction | null {
  const at = locate(p, itemId);
  if (!at) return null;
  if (selection?.canSelect && shift && key === ' ') return { kind: 'select' };
  if (selection?.grouped) {
    if ((key === 'Delete' || key === 'Backspace') && selection.canRetire)
      return { kind: 'trashGroup' };
    if (shift && canEdit && (key === 'ArrowLeft' || key === 'ArrowRight'))
      return { kind: 'moveGroup', step: key === 'ArrowLeft' ? -1 : 1 };
  }
  const items = cellItems(p, at.col, at.lane);
  const item = items[at.index]!;
  const title = `#${item.key} ${itemTitle(item)}`;
  if (key === 'Enter' || key === ' ') return { kind: 'open' };
  if ((key === 'Delete' || key === 'Backspace') && canEdit)
    return { kind: 'trash', focusAfter: focusAfterTrash(p, at) };
  if ((key === 'n' || key === 'N') && !shift && canEdit) {
    const column = p.columns[at.col]!;
    return { kind: 'add', status: column.column.status, laneKey: column.lanes[at.lane]!.laneKey };
  }
  if (shift && canEdit) {
    if (key === 'ArrowLeft' || key === 'ArrowRight') {
      const col = at.col + (key === 'ArrowLeft' ? -1 : 1);
      const target = p.columns[col];
      if (!target) return null;
      const count = cellItems(p, col, at.lane).length + 1;
      return {
        kind: 'move',
        move: { status: target.column.status, before: null },
        // A sorted board puts it where its sort does, not last.
        announce: p.sorted
          ? `${title} moved to ${target.column.name}`
          : `${title} moved to ${target.column.name}, position ${count} of ${count}`,
      };
    }
    if ((key === 'ArrowUp' || key === 'ArrowDown') && p.sorted && sortedBy)
      return {
        kind: 'refuse',
        announce: `Sorted by ${sortedBy}: turn Sort Cards off to reorder by hand.`,
      };
    if (key === 'ArrowUp' || key === 'ArrowDown') {
      const up = key === 'ArrowUp';
      const neighbour = items[at.index + (up ? -1 : 1)];
      if (!neighbour) return null;
      const position = at.index + (up ? 0 : 2);
      return {
        kind: 'move',
        move: up ? { before: neighbour.id } : { after: neighbour.id },
        announce: `${title} moved to position ${position} of ${items.length}`,
      };
    }
    return null;
  }
  if (key === 'ArrowUp' || key === 'ArrowDown') {
    const next = items[at.index + (key === 'ArrowUp' ? -1 : 1)];
    return next ? { kind: 'focus', itemId: next.id } : null;
  }
  if (key === 'ArrowLeft' || key === 'ArrowRight') {
    const step = key === 'ArrowLeft' ? -1 : 1;
    for (let col = at.col + step; col >= 0 && col < p.columns.length; col += step) {
      const there = cellItems(p, col, at.lane);
      if (there.length)
        return { kind: 'focus', itemId: there[Math.min(at.index, there.length - 1)]!.id };
    }
    return null;
  }
  return null;
}
