// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createShape, type ShapeElement } from '@livediagram/document';
import { ITEM_TYPES, presetSetup, projectBoard, type Item } from '@livediagram/items';
import type { PlanContextValue } from '@/components/plan/PlanContext';
import { usePlanBoardDrop } from './usePlanBoardDrop';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));

// docs/specs/026-plan/items.md "Archive": a card dragged off an Archive board onto another comes back in the move
// itself, one write and one undo step, not a move and then a separate patch.
afterEach(() => vi.clearAllMocks());

const card = (fields: Item['fields']): Item => ({
  id: 'c1',
  type: 'task',
  key: 1,
  rank: 'i',
  fields: { title: 'Card', ...fields },
  rev: 1,
  createdAt: 0,
  updatedAt: 0,
  createdBy: { id: 'p', name: 'P', color: '#000000' },
  updatedBy: { id: 'p', name: 'P', color: '#000000' },
});

function dropOnKanban(item: Item) {
  const element = { ...createShape('plan-board', 0, 0), id: 'b1' } as ShapeElement;
  const setup = presetSetup('kanban');
  const items: ReadonlyMap<string, Item> = new Map([[item.id, item]]);
  const plan = {
    types: ITEM_TYPES,
    canEdit: true,
    moveItem: vi.fn(),
    patchItem: vi.fn(),
    announce: vi.fn(),
  } as unknown as PlanContextValue;
  const hook = renderHook(() =>
    usePlanBoardDrop({
      element,
      boardRef: { current: null },
      plan,
      setup,
      projection: projectBoard(setup, items),
      items,
      interactive: true,
      canEdit: true,
    }),
  );
  const status = setup.columns[1]!.status;
  hook.result.current.drop(item.id, { status, laneKey: '', beforeId: null });
  hook.unmount();
  return { plan, status };
}

describe('a card dragged off an Archive board', () => {
  it('is moved and restored in one write', () => {
    const { plan, status } = dropOnKanban(card({ status: 'elsewhere', archived: true }));
    expect(plan.moveItem).toHaveBeenCalledTimes(1);
    expect(plan.moveItem).toHaveBeenCalledWith('c1', {
      status,
      before: null,
      clear: ['archived'],
    });
    expect(plan.patchItem).not.toHaveBeenCalled();
  });

  it('leaves a card that was not archived to a plain move', () => {
    const { plan, status } = dropOnKanban(card({ status: 'elsewhere' }));
    expect(plan.moveItem).toHaveBeenCalledWith('c1', { status, before: null });
    expect(plan.patchItem).not.toHaveBeenCalled();
  });
});
