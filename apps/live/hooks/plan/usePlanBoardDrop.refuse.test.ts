// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { createShape, type ShapeElement } from '@livediagram/document';
import {
  ITEM_TYPES,
  presetSetup,
  projectBoard,
  type Item,
  type PlanBoardSetup,
} from '@livediagram/items';
import type { PlanContextValue } from '@/components/plan/PlanContext';
import { planBoardTarget } from './plan-board-targets';
import { usePlanBoardDrop } from './usePlanBoardDrop';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));

// docs/specs/026-plan/item-types.md "An item type": a dragged card is refused only a move into a status its type
// leaves out. One already in such a status is reordered there, or changes lanes, freely; a swimlane by type is
// checked with the lane's type.
const kanban = presetSetup('kanban');
const last = kanban.columns[kanban.columns.length - 1]!.status;
const first = kanban.columns[0]!.status;
const types = ITEM_TYPES.map((t) => (t.id === 'task' ? { ...t, excludedStatuses: [last] } : t));
const PERSON = { id: 'p', name: 'Me', color: '#2563eb' };
const card = (id: string, type: string, status: string): Item => ({
  id,
  type,
  key: 1,
  rank: id,
  fields: { title: id, status },
  rev: 1,
  createdAt: 0,
  updatedAt: 0,
  createdBy: PERSON,
  updatedBy: PERSON,
});

function board(setup: PlanBoardSetup, list: Item[]) {
  const element = { ...createShape('plan-board', 0, 0), id: 'b1' } as ShapeElement;
  const items: ReadonlyMap<string, Item> = new Map(list.map((i) => [i.id, i]));
  const plan = {
    types,
    canEdit: true,
    statusNames: new Map(),
    announce: vi.fn(),
  } as unknown as PlanContextValue;
  const hook = renderHook(() =>
    usePlanBoardDrop({
      element,
      boardRef: { current: null },
      plan,
      setup,
      projection: projectBoard(setup, items, undefined, types),
      items,
      interactive: true,
      canEdit: true,
    }),
  );
  return { target: planBoardTarget('b1')!, hook };
}

describe('a dragged card over a column its type leaves out', () => {
  it('is refused from another status, never in the status it is in', () => {
    const inIt = card('a', 'task', last);
    const out = card('b', 'task', first);
    const { target, hook } = board(kanban, [inIt, out]);
    const slot = { status: last, laneKey: '', beforeId: null };
    expect(target.refuseAt(out, slot)).toMatch(/^Task cards can't be /);
    expect(target.refuseAt(inIt, slot)).toBeNull();
    expect(target.refuseAt(inIt, { status: first, laneKey: '', beforeId: null })).toBeNull();
    hook.unmount();
  });

  it('checks the type a swimlane by type gives the card', () => {
    const setup: PlanBoardSetup = { ...kanban, swimlaneBy: 'type' };
    const note = card('n', 'note', first);
    const task = card('t', 'task', first);
    const { target, hook } = board(setup, [note, task]);
    // A Note dropped into the Task lane of the left-out column becomes a Task there: refused.
    expect(target.refuseAt(note, { status: last, laneKey: 't:task', beforeId: null })).toMatch(
      /^Task cards can't be /,
    );
    // A Task dropped into the Note lane becomes a Note, which may be there.
    expect(target.refuseAt(task, { status: last, laneKey: 't:note', beforeId: null })).toBeNull();
    hook.unmount();
  });
});
