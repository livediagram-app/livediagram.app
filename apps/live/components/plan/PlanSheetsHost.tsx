'use client';

// Renders the open item panel or board set-up (docs/specs/025-plan/plan-board.md) beside the canvas,
// from the editor's Plan slice and the active tab: the tab's boards give the status picker its names
// and the set-up its board.
import { useMemo } from 'react';
import type { Element } from '@livediagram/document';
import { normaliseBoardSetup, itemStatus, type PlanBoardSetup } from '@livediagram/items';
import type { PlanSlice } from '@/hooks/plan/usePlanSlice';
import { BoardSetupPanel, trackSetup } from './BoardSetupPanel';
import { ItemPanel } from './ItemPanel';

function boardsOf(elements: readonly Element[]): { id: string; setup: PlanBoardSetup }[] {
  return elements.flatMap((el) => {
    if (el.type !== 'shape' || el.shape !== 'plan-board') return [];
    const setup = normaliseBoardSetup(el.planBoard);
    return setup ? [{ id: el.id, setup }] : [];
  });
}

export function PlanSheetsHost({
  plan,
  elements,
}: {
  plan: PlanSlice;
  elements: readonly Element[];
}) {
  const ctx = plan.context;
  const boards = useMemo(() => boardsOf(elements), [elements]);
  const statuses = useMemo(() => {
    const seen = new Map<string, string>();
    for (const b of boards)
      for (const c of b.setup.columns) if (!seen.has(c.status)) seen.set(c.status, c.name);
    return [...seen].map(([status, name]) => ({ status, name }));
  }, [boards]);
  const epics = useMemo(
    () => [...ctx.items.values()].filter((i) => i.type === 'epic').sort((a, b) => a.key - b.key),
    [ctx.items],
  );
  const item = plan.openItemId ? ctx.items.get(plan.openItemId) : undefined;
  const board = plan.setupBoardId ? boards.find((b) => b.id === plan.setupBoardId) : undefined;
  if (item) {
    return (
      <ItemPanel
        key={item.id}
        item={item}
        statuses={statuses}
        epics={epics}
        people={ctx.people}
        canEdit={ctx.canEdit}
        onSave={(field, value) =>
          ctx.patchItem(
            item.id,
            value === undefined ? { clear: [field] } : { set: { [field]: value } },
          )
        }
        onType={(type) => ctx.patchItem(item.id, { type })}
        onDelete={() => ctx.deleteItem(item.id)}
        onClose={plan.closeItem}
      />
    );
  }
  if (board && ctx.canEdit) {
    return (
      <BoardSetupPanel
        key={board.id}
        setup={board.setup}
        items={ctx.items}
        onChange={(next, part) => {
          ctx.updateBoard(board.id, next);
          trackSetup(part);
        }}
        onMoveItems={(from, to) => {
          for (const it of ctx.items.values())
            if (itemStatus(it) === from) ctx.moveItem(it.id, { status: to, before: null });
        }}
        onClose={plan.closeSetup}
      />
    );
  }
  return null;
}
