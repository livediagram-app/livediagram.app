// A board's card type chips (docs/specs/026-plan/plan-board.md "Card type chips"): who sees them and where, and the
// cell a chip's click adds its card to. Pure, so the role and place rules are tested without a board.
import {
  typeIn,
  type BoardProjection,
  type ItemFields,
  type ItemTypeDef,
  type PlanBoardSetup,
} from '@liveplanner/items';
import { cellStatus, laneMove } from './plan-board-moves';
import { newCardStatus } from './new-card-status';

// Above this many types the chips drop their names and keep their little cards (the tooltip names each).
export const CHIP_NAMES_MAX = 3;
// The placeholder a carried chip opens: a Minimal card's height.
export const CHIP_GHOST_HEIGHT_PX = 56;
// What a carried chip's placeholder is keyed by: no card on any board has this id.
export const CHIP_DRAG_ID = 'card-type-chip';

// Whether the board's header shows its chips: someone who may add cards (an Editor or a Participant), in Plan mode,
// on a wider screen than a phone, on a set-up board that takes new cards and some types, outside a Dashboard slot.
export function chipsShown(input: {
  interactive: boolean;
  canEditCards: boolean;
  phone: boolean;
  simplified: boolean;
  setup: Pick<PlanBoardSetup, 'archive' | 'columns'>;
  types: readonly unknown[];
}): boolean {
  const { interactive, canEditCards, phone, simplified, setup, types } = input;
  return (
    interactive &&
    canEditCards &&
    !phone &&
    !simplified &&
    !setup.archive &&
    setup.columns.length > 0 &&
    types.length > 0
  );
}

export type ChipCard = {
  type: string;
  fields: ItemFields;
  status: string;
  after: string | null;
  // The column it lands in, for the announcement.
  columnName: string;
};

// A chip's click: a card of the type at the end of the column of its starting status when the board has one, else
// the board's first column, in the first row (taking the row's field). Null on a board with no columns.
export function chipClickCell(
  setup: PlanBoardSetup,
  projection: BoardProjection,
  types: readonly ItemTypeDef[],
  typeId: string,
  statusNames: ReadonlyMap<string, string>,
): ChipCard | null {
  const def = typeIn(types, typeId);
  const starting = newCardStatus(def, statusNames);
  const col = projection.columns.find((c) => c.column.status === starting) ?? projection.columns[0];
  if (!col) return null;
  const lane = projection.lanes[0];
  const cell = col.lanes.find((l) => l.laneKey === lane?.key)?.items ?? [];
  return {
    type: def.id,
    fields: { title: def.newTitle, ...(projection.swimlanes ? (laneMove(lane).set ?? {}) : {}) },
    status: cellStatus(setup, col.column.status, lane),
    after: cell[cell.length - 1]?.id ?? null,
    columnName: col.column.name,
  };
}
