'use client';

// A Plan board's column heads (PlanBoardView.tsx): a slot board's, a collapsed column's strip, or the column's own
// head with its settings, reorder and card moves (docs/specs/026-plan/plan-board.md "What the board shows").
import { itemStatus, isTrashed } from '@liveplanner/items';
import { track } from '@/lib/telemetry';
import {
  cardsMovingRefused,
  columnCardMoves,
  cardsStayedMessage,
} from '@/hooks/plan/status-refusal';
import { PlanColumnHeader } from './PlanColumnHeader';
import { trackSetup } from './track-board-setup';
import { CollapsedColumnHead } from './CollapsedColumn';
import { COLUMN_REORDERED } from './useColumnReorder';
import { SlotColumnHeader } from './SlotColumnHeader';
import { AddCardButton } from './AddCardButton';
import type { PlanBoardViewValues } from './plan-board-view-values';

export function planBoardColumnHeads(v: PlanBoardViewValues) {
  const {
    projection,
    simplified,
    palette,
    frameColumn,
    addInHead,
    mayAdd,
    addTypes,
    adding,
    lanes,
    closeAdding,
    addInto,
    shutColumns,
    toneOf,
    toggleColumn,
    canCollapse,
    setup,
    setUpHere,
    reorder,
    plan,
    element,
    items,
    columnName,
  } = v;
  return projection.columns.map((col, position) =>
    simplified ? (
      <SlotColumnHeader
        key={col.column.id}
        col={col}
        palette={palette}
        onFrame={frameColumn ?? undefined}
        add={
          addInHead && mayAdd ? (
            <AddCardButton
              compact
              palette={palette}
              types={addTypes}
              label={`Add a card to ${col.column.name}`}
              open={adding?.status === col.column.status && adding.laneKey === lanes[0]?.key}
              onClosed={closeAdding}
              onAdd={addInto(
                col.column.status,
                lanes[0],
                col.lanes.find((l) => l.laneKey === lanes[0]?.key)?.items ?? [],
              )}
            />
          ) : null
        }
      />
    ) : shutColumns.has(col.column.id) ? (
      <CollapsedColumnHead
        key={`${col.column.id}-strip`}
        column={col.column}
        palette={toneOf(col.column.id).palette}
        bar={toneOf(col.column.id).bar}
        onExpand={() => toggleColumn(col.column.id)}
      />
    ) : (
      <PlanColumnHeader
        key={col.column.id}
        onCollapse={canCollapse ? () => toggleColumn(col.column.id) : undefined}
        col={col}
        setup={setup}
        palette={toneOf(col.column.id).palette}
        bar={toneOf(col.column.id).bar}
        canEdit={setUpHere}
        reorder={reorder.reorderFor(col.column.id, position)}
        onChange={(next, part) => {
          if (part === COLUMN_REORDERED) return reorder.reordered(next, col.column.id);
          plan?.updateBoard(element.id, next);
          trackSetup(part);
        }}
        onMoveCards={(from, to) => {
          if (!plan) return;
          const moving = [...items.values()].filter((it) => itemStatus(it) === from);
          const stay = cardsMovingRefused(moving, plan.types, to);
          // One write, one undo step and one room op for the whole column, never one per card.
          const moves = columnCardMoves(moving, stay, to);
          if (plan.moveItems && moves.length) {
            plan.moveItems(moves);
            track('Plan', 'Moved', 'Board');
          } else for (const m of moves) plan.moveItem(m.id, m.move);
          // One announcement for the cards whose type leaves the status out, never one each.
          if (stay.size) plan.announce(cardsStayedMessage(stay.size, columnName(to)));
        }}
        onFrame={frameColumn ?? undefined}
        onDeleteStatus={(status) => plan?.removeStatusColumns(status, element.id)}
        onTrashCards={(status) => {
          if (!plan) return;
          // Every card in the state, whatever board shows it (the column's removal moves them all).
          const went = plan.trashItems(
            [...plan.items.values()]
              .filter((it) => itemStatus(it) === status && !isTrashed(it))
              .map((it) => it.id),
          );
          if (went) plan.announce(`${went === 1 ? 'Card' : `${went} cards`} moved to the Trash`);
        }}
      />
    ),
  );
}
