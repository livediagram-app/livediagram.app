// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createShape, type ShapeElement } from '@livediagram/document';
import { ITEM_TYPES, presetSetup, projectBoard, type Item } from '@livediagram/items';
import type { PlanContextValue } from '@/components/plan/PlanContext';
import { planBoardTarget } from './plan-board-targets';
import { usePlanBoardDrop } from './usePlanBoardDrop';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));

// docs/specs/026-plan/plan-mode.md "The palette": a palette card placed in a column is made and opened at once.
afterEach(() => vi.clearAllMocks());

function board() {
  const element = { ...createShape('plan-board', 0, 0), id: 'b1' } as ShapeElement;
  const setup = presetSetup('kanban');
  const items: ReadonlyMap<string, Item> = new Map();
  const plan = {
    types: ITEM_TYPES,
    canEdit: true,
    addItem: vi.fn(),
    openNewItem: vi.fn(),
    openItem: vi.fn(),
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
  return { plan, setup, hook };
}

describe('a palette card placed in a column', () => {
  it('is made with its own id and opened as fresh', () => {
    const { plan, setup, hook } = board();
    const status = setup.columns[0]!.status;
    planBoardTarget('b1')!.addCard('task', { status, laneKey: '', beforeId: null });
    const made = vi.mocked(plan.addItem).mock.calls[0]![0];
    expect(made.id).toBeTruthy();
    expect(plan.openNewItem).toHaveBeenCalledWith(made.id);
    expect(plan.openItem).not.toHaveBeenCalled();
    hook.unmount();
  });
});
