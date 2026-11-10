// The Plan board's cards as its set-up draws them (docs/specs/026-plan/plan-board.md, blueprint plan-board.md), for
// PlanBoardView: the projection into columns and rows, whether the board is a busy one, the statuses a column can be
// made for, and what the header's widgets count.
import { useMemo } from 'react';
import {
  isQuickFilterEmpty,
  projectBoard,
  type Item,
  type ItemTypeDef,
  type PlanBoardSetup,
  type QuickFilter,
} from '@liveplanner/items';
import { boardItems } from '@liveplanner/plan-art';
import { pickableStatuses } from './column-status-picks';
import { NO_STATUSES, PLAN_BUSY_CARDS } from './plan-board-view-consts';

export function usePlanBoardProjection(
  setup: PlanBoardSetup | null,
  items: ReadonlyMap<string, Item>,
  applied: QuickFilter,
  types: readonly ItemTypeDef[],
  statusNames: ReadonlyMap<string, string> | undefined,
) {
  const projection = useMemo(
    () => (setup ? projectBoard(setup, items, applied, types, statusNames) : null),
    [setup, items, applied, types, statusNames],
  );
  const busy = (projection?.total ?? 0) > PLAN_BUSY_CARDS;
  // The statuses a column can be made for: the boards', any a card is in and the card types' Default States
  // (docs/specs/026-plan/plan-board.md "The column picker").
  const pickable = useMemo(
    () => pickableStatuses(statusNames ?? NO_STATUSES, items.values(), types),
    [statusNames, items, types],
  );
  // What the header's widgets count: the items the board shows, before the quick filter.
  // With no quick filter on (the usual case) the board's own projection already holds them: no second projection.
  const quickOn = !isQuickFilterEmpty(applied);
  const shownItems = useMemo(
    () =>
      !setup
        ? []
        : boardItems(
            quickOn || !projection
              ? projectBoard(setup, items, undefined, types, statusNames)
              : projection,
          ),
    [setup, items, types, statusNames, quickOn, projection],
  );
  return { projection, busy, pickable, shownItems };
}
