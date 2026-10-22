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
} from '@livepages/items';
import type { Rect } from './geometry-primitives';

const PLAN_BOARD_HEADER_H = 52;
export const PLAN_BOARD_PAD = 12;
const PLAN_BOARD_GAP = 12;
const PLAN_COLUMN_HEAD_H = 34;
export const PLAN_CARD_H = 64;
const PLAN_CARD_GAP = 8;

interface PlanCardSlot extends Rect {
  item: Item;
}

interface PlanColumnSlot extends Rect {
  column: PlanColumn;
  count: number;
  overLimit: boolean;
  // The cards that fit, top to bottom; the rest of the column's cards are cut off, as on a short board.
  cards: PlanCardSlot[];
  // How many of its cards did not fit: the export says so at the column's foot ("+3 more"), never dropping them
  // silently.
  hidden: number;
}

// The room kept at a column's foot for its "+n more" line when its cards do not all fit.
const PLAN_MORE_H = 20;

interface PlanLaneSlot {
  key: string;
  label: string;
  // The lane's band: its header row at `y`, its cards below, `height` in all.
  y: number;
  height: number;
  colour?: string;
}

interface PlanBoardLayout {
  setup: PlanBoardSetup;
  projection: BoardProjection;
  columns: PlanColumnSlot[];
  // A swimlane board's rows, top to bottom, across every column (none without swimlanes).
  lanes: PlanLaneSlot[];
}

// A swimlane's header row.
export const PLAN_LANE_HEAD_H = 26;

// Null for a board with no readable set-up (it draws as its bare frame). `cardHeight` measures a card face at a
// column's card width (the SVG export draws each as tall as its Display needs); absent, every card is PLAN_CARD_H.
export function planBoardLayout(
  el: Rect & { planBoard?: unknown },
  items: ReadonlyMap<string, Item> | undefined,
  types: readonly ItemTypeDef[] = ITEM_TYPES,
  cardHeight: (item: Item, width: number) => number = () => PLAN_CARD_H,
): PlanBoardLayout | null {
  const setup = normaliseBoardSetup(el.planBoard);
  if (!setup) return null;
  const projection = projectBoard(setup, items ?? new Map(), undefined, types);
  const n = projection.columns.length;
  const colW = (el.width - PLAN_BOARD_PAD * 2 - PLAN_BOARD_GAP * (n - 1)) / n;
  const cardW = colW - 16;
  const top = el.y + PLAN_BOARD_HEADER_H;
  const colH = el.height - PLAN_BOARD_HEADER_H - PLAN_BOARD_PAD;
  const bottom = top + colH - 6;
  const xOf = (i: number) => el.x + PLAN_BOARD_PAD + i * (colW + PLAN_BOARD_GAP);
  const heights = new Map<string, number>();
  const heightOf = (item: Item) => {
    const known = heights.get(item.id);
    if (known !== undefined) return known;
    const h = cardHeight(item, cardW);
    heights.set(item.id, h);
    return h;
  };
  const cardsBy = projection.columns.map(() => [] as PlanCardSlot[]);
  const lanes: PlanLaneSlot[] = [];
  if (!projection.swimlanes) {
    projection.columns.forEach((col, i) => {
      let y = top + PLAN_COLUMN_HEAD_H;
      for (const item of col.lanes.flatMap((l) => l.items)) {
        const h = heightOf(item);
        if (y + h > bottom) break;
        cardsBy[i]!.push({ item, x: xOf(i) + 8, y, width: cardW, height: h });
        y += h + PLAN_CARD_GAP;
      }
    });
  } else {
    // Each lane as tall as its fullest column; lanes past the board's foot are cut off, as on a short board.
    let y = top + PLAN_COLUMN_HEAD_H;
    for (const lane of projection.lanes) {
      if (y + PLAN_LANE_HEAD_H > bottom) break;
      const laneTop = y;
      let tallest = 0;
      projection.columns.forEach((col, i) => {
        const inLane = col.lanes.find((l) => l.laneKey === lane.key)?.items ?? [];
        let cy = laneTop + PLAN_LANE_HEAD_H;
        for (const item of inLane) {
          const h = heightOf(item);
          if (cy + h > bottom) break;
          cardsBy[i]!.push({ item, x: xOf(i) + 8, y: cy, width: cardW, height: h });
          cy += h + PLAN_CARD_GAP;
        }
        tallest = Math.max(tallest, cy - laneTop - PLAN_LANE_HEAD_H);
      });
      const height = PLAN_LANE_HEAD_H + Math.max(tallest, 12);
      lanes.push({
        key: lane.key,
        label: lane.label,
        y: laneTop,
        height,
        ...(lane.colour ? { colour: lane.colour } : {}),
      });
      y = laneTop + height + PLAN_CARD_GAP;
    }
  }
  // A column whose cards did not all fit gives up its last ones until its "+n more" line has room.
  const columns = projection.columns.map((col, i): PlanColumnSlot => {
    const total = col.lanes.reduce((n, l) => n + l.items.length, 0);
    const cards = cardsBy[i]!;
    if (cards.length < total)
      while (
        cards.length &&
        cards[cards.length - 1]!.y + cards[cards.length - 1]!.height > bottom - PLAN_MORE_H
      )
        cards.pop();
    return {
      column: col.column,
      count: col.count,
      overLimit: col.overLimit,
      x: xOf(i),
      y: top,
      width: colW,
      height: colH,
      cards,
      hidden: total - cards.length,
    };
  });
  return { setup, projection, columns, lanes };
}
