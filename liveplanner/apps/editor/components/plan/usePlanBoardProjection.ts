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

// A board with no set-up shows no cards.
const NO_SHOWN: readonly Item[] = [];

// `setup` is the board's set-up WITHOUT its filter (useDrawnSetup), so a filter change (a teammate's included) leaves it,
// and with it the unfiltered projection and the widgets' cards, as they were: only the filtered projection is made
// again (docs/specs/026-plan/board-widgets.md "The board's filter"; blueprint "Performance and limits").
export function usePlanBoardProjection(
  setup: PlanBoardSetup | null,
  items: ReadonlyMap<string, Item>,
  applied: QuickFilter,
  types: readonly ItemTypeDef[],
  statusNames: ReadonlyMap<string, string> | undefined,
) {
  // The board's cards before the quick filter: what the header's widgets count, and the projection itself while
  // nothing narrows the board (the usual case: one projection, not two).
  const unfiltered = useMemo(
    () => (setup ? projectBoard(setup, items, undefined, types, statusNames) : null),
    [setup, items, types, statusNames],
  );
  const quickOn = !isQuickFilterEmpty(applied);
  const projection = useMemo(
    () => (setup && quickOn ? projectBoard(setup, items, applied, types, statusNames) : unfiltered),
    [setup, items, applied, types, statusNames, quickOn, unfiltered],
  );
  const busy = (projection?.total ?? 0) > PLAN_BUSY_CARDS;
  // The statuses a column can be made for: the boards', any a card is in and the card types' Default States
  // (docs/specs/026-plan/plan-board.md "The column picker").
  const pickable = useMemo(
    () => pickableStatuses(statusNames ?? NO_STATUSES, items.values(), types),
    [statusNames, items, types],
  );
  // What the header's widgets count: the items the board shows, before the quick filter. One list while the cards and
  // the set-up stand, whatever the filter does, so every widget's count is kept (kept-stat.ts, fieldSummaryOf).
  const shownItems = useMemo(() => (unfiltered ? boardItems(unfiltered) : NO_SHOWN), [unfiltered]);
  // A filter that hides every card the board holds (docs/specs/026-plan/board-widgets.md "When the filter hides every
  // card"): never a board that is really empty.
  // Whether it draws any card at all, after the filter: Hide From Recording reads it (board-shown-store.ts).
  const showsAny =
    !!projection && projection.columns.some((c) => c.lanes.some((l) => l.items.length > 0));
  const hidesAll = quickOn && !!projection && projection.total > 0 && !showsAny;
  return { projection, busy, pickable, shownItems, hidesAll, showsAny };
}
