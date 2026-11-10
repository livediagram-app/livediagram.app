// A key on a Plan board's card (PlanBoardView.tsx): what the board's keyboard (plan-board-keys.ts) makes of it, done
// against the board as drawn (docs/specs/026-plan/plan-board.md "Keyboard").
import type { Dispatch, RefObject, SetStateAction } from 'react';
import {
  boardSortFieldOf,
  type BoardProjection,
  type Item,
  type PlanBoardSetup,
} from '@liveplanner/items';
import { track } from '@/lib/telemetry';
import { moveStatusRefusal } from '@/hooks/plan/status-refusal';
import type { useBoardSelection } from '@/hooks/plan/useBoardSelection';
import { focusPlanCard } from '@/hooks/plan/useCardRunReveal';
import { planBoardKey } from './plan-board-keys';
import { groupColumnMoves } from './board-selection';
import type { PlanContextValue } from './PlanContext';

// What a card's key reads of its board, this render's.
export interface BoardCardKeyContext {
  plan: PlanContextValue | undefined;
  setup: PlanBoardSetup | null;
  projection: BoardProjection | null;
  items: ReadonlyMap<string, Item>;
  shutColumns: ReadonlySet<string>;
  canEdit: boolean;
  canEditCards: boolean;
  simplified: boolean;
  selection: ReturnType<typeof useBoardSelection>;
  columnName: (s: string) => string;
  focusNextRef: RefObject<string | null>;
  boardRef: RefObject<HTMLDivElement | null>;
  setAdding: Dispatch<SetStateAction<{ status: string; laneKey: string } | null>>;
}

export function boardCardKey(
  ctx: BoardCardKeyContext,
  item: Item,
  e: React.KeyboardEvent<HTMLElement>,
): void {
  const {
    plan,
    setup,
    projection,
    items,
    shutColumns,
    canEdit,
    canEditCards,
    simplified,
    selection,
    columnName,
    focusNextRef,
    boardRef,
    setAdding,
  } = ctx;
  if (!plan || !setup || !projection) return;
  // A sorted board's first field, named when Shift+Up/Down cannot reorder.
  const first = setup.sortBy?.[0]?.field;
  const sortedBy = first ? (boardSortFieldOf(first, plan.types)?.label ?? first) : undefined;
  // Arrows pass over a collapsed column, whose cards are not drawn; Shift+Arrows still move a card into one.
  const drawn =
    shutColumns.size && !e.shiftKey
      ? {
          ...projection,
          columns: projection.columns.map((c) =>
            shutColumns.has(c.column.id)
              ? { ...c, lanes: c.lanes.map((l) => ({ ...l, items: [] })) }
              : c,
          ),
        }
      : projection;
  const action = planBoardKey(drawn, item.id, e.key, e.shiftKey, canEditCards, sortedBy, {
    canSelect: canEditCards && !simplified,
    grouped: selection.ids.has(item.id) && selection.ids.size > 1,
    canRetire: canEdit,
  });
  if (!action) return;
  e.preventDefault();
  e.stopPropagation();
  if (action.kind === 'select') selection.toggle(item.id);
  else if (action.kind === 'moveGroup') {
    // Each selected card one column on from its own, as one write; a card whose type leaves that column out stays.
    const moves = groupColumnMoves(projection, selection.ordered, action.step).filter((m) => {
      const it = items.get(m.id);
      return !!it && !moveStatusRefusal(plan.types, it, m.move, columnName);
    });
    if (moves.length === 0) plan.announce('The selected cards can’t move that way');
    else {
      focusNextRef.current = item.id;
      plan.moveItems?.(moves);
      track('Plan', 'Moved', 'Cards');
      plan.announce(`${moves.length === 1 ? '1 card' : `${moves.length} cards`} moved`);
    }
  } else if (action.kind === 'trashGroup') {
    const went = plan.trashItems(selection.ordered);
    if (went) plan.announce(`${went === 1 ? '1 card' : `${went} cards`} moved to the Trash`);
    selection.clear();
  } else if (action.kind === 'focus') {
    focusPlanCard(boardRef.current, action.itemId);
  } else if (action.kind === 'open') plan.openItem(item.id);
  else if (action.kind === 'trash') {
    // Focus goes on to a neighbour rather than falling to the page with the card.
    focusNextRef.current = action.focusAfter;
    plan.trashItem(item.id);
    plan.announce(`#${item.key} moved to the Trash`);
  } else if (action.kind === 'add') setAdding({ status: action.status, laneKey: action.laneKey });
  else if (action.kind === 'refuse') plan.announce(action.announce);
  else {
    // A column whose status the card's type leaves out (docs/specs/026-plan/item-types.md "An item type").
    const refused = moveStatusRefusal(plan.types, item, action.move, columnName);
    if (refused) {
      plan.announce(refused);
      return;
    }
    focusNextRef.current = item.id;
    plan.moveItem(item.id, action.move);
    plan.announce(action.announce);
  }
}
