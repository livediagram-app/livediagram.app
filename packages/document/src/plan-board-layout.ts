// Where a Plan board's parts sit in an export (docs/specs/026-plan/plan-board.md "Both elements everywhere"):
// its title, its columns and the card faces that fit in each. One layout, read by the SVG export and the
// Excalidraw export, so the two draw a board the same way. Pure.

import {
  ITEM_TYPES,
  normaliseBoardSetup,
  projectBoard,
  type BoardProjection,
  type Item,
  type ItemTypeDef,
  type PlanBoardSetup,
  type PlanColumn,
} from '@livediagram/items';

export const PLAN_BOARD_HEADER_H = 52;
export const PLAN_BOARD_PAD = 12;
export const PLAN_BOARD_GAP = 12;
export const PLAN_COLUMN_HEAD_H = 34;
export const PLAN_CARD_H = 64;
export const PLAN_CARD_GAP = 8;

type Box = { x: number; y: number; width: number; height: number };

export interface PlanCardSlot extends Box {
  item: Item;
}

export interface PlanColumnSlot extends Box {
  column: PlanColumn;
  count: number;
  overLimit: boolean;
  // The cards that fit, top to bottom; the rest of the column's cards are cut off, as on a short board.
  cards: PlanCardSlot[];
}

export interface PlanBoardLayout {
  setup: PlanBoardSetup;
  projection: BoardProjection;
  columns: PlanColumnSlot[];
}

// Null for a board with no readable set-up (it draws as its bare frame).
export function planBoardLayout(
  el: Box & { planBoard?: unknown },
  items: ReadonlyMap<string, Item> | undefined,
  types: readonly ItemTypeDef[] = ITEM_TYPES,
): PlanBoardLayout | null {
  const setup = normaliseBoardSetup(el.planBoard);
  if (!setup) return null;
  const projection = projectBoard(setup, items ?? new Map(), undefined, types);
  const n = projection.columns.length;
  const colW = (el.width - PLAN_BOARD_PAD * 2 - PLAN_BOARD_GAP * (n - 1)) / n;
  const top = el.y + PLAN_BOARD_HEADER_H;
  const colH = el.height - PLAN_BOARD_HEADER_H - PLAN_BOARD_PAD;
  const columns = projection.columns.map((col, i): PlanColumnSlot => {
    const x = el.x + PLAN_BOARD_PAD + i * (colW + PLAN_BOARD_GAP);
    const cards: PlanCardSlot[] = [];
    let y = top + PLAN_COLUMN_HEAD_H;
    for (const item of col.lanes.flatMap((l) => l.items)) {
      if (y + PLAN_CARD_H > top + colH - 6) break;
      cards.push({ item, x: x + 8, y, width: colW - 16, height: PLAN_CARD_H });
      y += PLAN_CARD_H + PLAN_CARD_GAP;
    }
    return {
      column: col.column,
      count: col.count,
      overLimit: col.overLimit,
      x,
      y: top,
      width: colW,
      height: colH,
      cards,
    };
  });
  return { setup, projection, columns };
}
