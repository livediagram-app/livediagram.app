// A Plan board's keyboard (docs/specs/026-plan/plan-board.md "Keyboard"), as a pure function of the
// board as drawn: arrow keys move focus between cards, Shift+Left/Right moves the card a column,
// Shift+Up/Down moves it within its column, Enter opens, Delete moves it to the Trash, N adds to the column.
import { itemTitle, type BoardProjection, type ItemMove } from '@livediagram/items';

export type PlanKeyAction =
  | { kind: 'focus'; itemId: string }
  | { kind: 'move'; move: ItemMove; announce: string }
  | { kind: 'open' }
  | { kind: 'trash' }
  | { kind: 'add'; status: string; laneKey: string };

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

export function planBoardKey(
  p: BoardProjection,
  itemId: string,
  key: string,
  shift: boolean,
  canEdit: boolean,
): PlanKeyAction | null {
  const at = locate(p, itemId);
  if (!at) return null;
  const items = cellItems(p, at.col, at.lane);
  const item = items[at.index]!;
  const title = `#${item.key} ${itemTitle(item)}`;
  if (key === 'Enter' || key === ' ') return { kind: 'open' };
  if ((key === 'Delete' || key === 'Backspace') && canEdit) return { kind: 'trash' };
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
        announce: `${title} moved to ${target.column.name}, position ${count} of ${count}`,
      };
    }
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
