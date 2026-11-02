// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createShape, type ShapeElement } from '@liveplanner/project';
import {
  ITEM_TYPES,
  presetSetup,
  projectBoard,
  type Item,
  type ItemTypeDef,
  type PlanBoardSetup,
} from '@liveplanner/items';
import type { PlanContextValue } from '@/components/plan/PlanContext';
import { planBoardTarget } from './plan-board-targets';
import { usePlanBoardDrop } from './usePlanBoardDrop';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));

// docs/specs/026-plan/plan-board.md "Several cards at once": a group let go on a board lands as one write.
afterEach(() => vi.clearAllMocks());

const card = (id: string, fields: Item['fields'], type = 'task'): Item => ({
  id,
  type,
  key: 1,
  rank: id,
  fields: { title: id, ...fields },
  rev: 1,
  createdAt: 0,
  updatedAt: 0,
  createdBy: { id: 'p', name: 'P', color: '#000000' },
  updatedBy: { id: 'p', name: 'P', color: '#000000' },
});

function board(setup: PlanBoardSetup, list: Item[], types: readonly ItemTypeDef[] = ITEM_TYPES) {
  const element = { ...createShape('plan-board', 0, 0), id: 'b1' } as ShapeElement;
  const items: ReadonlyMap<string, Item> = new Map(list.map((i) => [i.id, i]));
  const plan = {
    types,
    canEdit: true,
    statusNames: new Map(),
    moveItems: vi.fn(),
    patchItems: vi.fn(),
    trashItems: vi.fn((ids: readonly string[]) => ids.length),
    announce: vi.fn(),
  } as unknown as PlanContextValue & Record<string, ReturnType<typeof vi.fn>>;
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
  return { plan, hook };
}

describe('a group dropped on a board', () => {
  it('lands every card together in one write, announced once', () => {
    const setup = presetSetup('kanban');
    const [todo, doing] = setup.columns.map((c) => c.status);
    const { plan, hook } = board(setup, [
      card('a', { status: todo! }),
      card('b', { status: todo! }),
    ]);
    hook.result.current.dropGroup(['a', 'b'], { status: doing!, laneKey: '', beforeId: null });
    expect(plan.moveItems).toHaveBeenCalledOnce();
    expect(plan.moveItems).toHaveBeenCalledWith([
      { id: 'a', move: { status: doing, before: null } },
      { id: 'b', move: { status: doing, after: 'a' } },
    ]);
    expect(plan.announce).toHaveBeenCalledWith(`2 cards moved to ${setup.columns[1]!.name}`);
    hook.unmount();
  });

  it('keeps the cards whose type leaves the column out where they are, and says how many stayed', () => {
    const setup = presetSetup('kanban');
    const [todo, doing] = setup.columns.map((c) => c.status);
    const types = ITEM_TYPES.map((t) => (t.id === 'action' ? { ...t, statuses: [todo!] } : t));
    const { plan, hook } = board(
      setup,
      [card('a', { status: todo! }), card('n', { status: todo! }, 'action')],
      types,
    );
    hook.result.current.dropGroup(['a', 'n'], { status: doing!, laneKey: '', beforeId: null });
    expect(plan.moveItems).toHaveBeenCalledWith([
      { id: 'a', move: { status: doing, before: null } },
    ]);
    expect(plan.announce).toHaveBeenCalledWith('Card moved to ' + setup.columns[1]!.name);
    expect(plan.announce).toHaveBeenLastCalledWith(
      `1 card stayed: its type can't be ${setup.columns[1]!.name}`,
    );
    hook.result.current.dropGroup(['n'], { status: doing!, laneKey: '', beforeId: null });
    expect(plan.moveItems).toHaveBeenCalledOnce();
    hook.unmount();
  });

  it('archives the cards on an Archive board, one write, leaving those already archived', () => {
    const setup = presetSetup('archive');
    const { plan, hook } = board(setup, [
      card('a', { status: 'x' }),
      card('b', { status: 'x', archived: true }),
    ]);
    hook.result.current.dropGroup(['a', 'b'], { status: 'x', laneKey: '', beforeId: null });
    expect(plan.patchItems).toHaveBeenCalledWith([{ id: 'a', patch: { set: { archived: true } } }]);
    expect(plan.announce).toHaveBeenCalledWith('Card archived');
    hook.result.current.dropGroup(['b'], { status: 'x', laneKey: '', beforeId: null });
    expect(plan.patchItems).toHaveBeenCalledOnce();
    hook.unmount();
  });

  it('takes a group from another board through its registration', () => {
    const setup = presetSetup('kanban');
    const [todo, doing] = setup.columns.map((c) => c.status);
    const { plan, hook } = board(setup, [
      card('a', { status: todo! }),
      card('b', { status: todo! }),
    ]);
    planBoardTarget('b1')!.dropMany!(['a', 'b'], { status: doing!, laneKey: '', beforeId: null });
    expect(plan.moveItems).toHaveBeenCalledOnce();
    hook.unmount();
  });
});
