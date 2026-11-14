// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { Item, ItemTypeDef } from '@liveplanner/items';
import { usePlanItemWrites } from './usePlanItemWrites';
import type { PlanItems } from './usePlanItems';
import type { ItemTypesSlice } from './useItemTypes';

// docs/specs/026-plan/item-types.md "Changing a card's type": every editor write that changes a card's type (the item
// panel's picker, a card table's cell, a drop into a row By Card Type, a group's move) carries its custom fields mapped
// by name in the same write, so it is one undo step; any other write goes as it was.
vi.mock('@/lib/telemetry', () => ({ track: vi.fn(), titleCaseType: (t: string) => t }));

const typeOf = (id: string, custom: ItemTypeDef['custom']): ItemTypeDef => ({
  id,
  label: id,
  newTitle: `New ${id}`,
  glyph: 'item',
  color: '#2563eb',
  fields: ['title', 'status', ...(custom ?? []).map((f) => f.id)],
  custom,
});
const IDEA = typeOf('idea', [
  { id: 'f-apps', label: 'App', kind: 'multichoice', options: ['Editor', 'API'] },
  { id: 'f-solution', label: 'Solution', kind: 'longtext' },
]);
const WORK = typeOf('work', [{ id: 'f-app', label: 'App', kind: 'choice', options: ['API'] }]);
const card: Item = {
  id: 'c1',
  type: 'idea',
  key: 1,
  rank: 'a',
  fields: { title: 'T', status: 'todo', 'f-apps': ['API'], 'f-solution': 'S' },
  rev: 1,
  createdAt: 0,
  updatedAt: 0,
  createdBy: { id: 'p', name: 'P', color: '#000000' },
  updatedBy: { id: 'p', name: 'P', color: '#000000' },
};

function writes() {
  const write = vi.fn(() => Promise.resolve(true));
  const planItems = {
    write,
    writeQuiet: write,
    items: new Map([[card.id, card]]),
    practiceIds: new Set<string>(),
    capturesPractice: () => false,
  } as unknown as PlanItems;
  const itemTypes = { types: [IDEA, WORK] } as unknown as ItemTypesSlice;
  const { result } = renderHook(() => usePlanItemWrites(planItems, itemTypes, vi.fn()));
  return { write, w: result.current };
}

describe('usePlanItemWrites on a type change', () => {
  it('maps the fields into the patch the item panel picker sends, one write', () => {
    const { write, w } = writes();
    void w.patchItem('c1', { type: 'work' });
    expect(write).toHaveBeenCalledTimes(1);
    expect(write).toHaveBeenCalledWith({
      kind: 'patch',
      id: 'c1',
      patch: { type: 'work', set: { 'f-app': 'API' } },
    });
  });

  it('maps them into a move and a group of moves (a row By Card Type) and a group of patches', () => {
    const { write, w } = writes();
    w.moveItem('c1', { status: 'todo', type: 'work' });
    expect(write).toHaveBeenLastCalledWith({
      kind: 'move',
      id: 'c1',
      move: { status: 'todo', type: 'work', set: { 'f-app': 'API' } },
    });
    w.moveItems([
      { id: 'c1', move: { status: 'todo', type: 'work' } },
      { id: 'gone', move: { status: 'todo', type: 'work' } },
    ]);
    expect(write).toHaveBeenLastCalledWith({
      kind: 'moves',
      moves: [
        { id: 'c1', move: { status: 'todo', type: 'work', set: { 'f-app': 'API' } } },
        { id: 'gone', move: { status: 'todo', type: 'work' } },
      ],
    });
    w.moveItems([{ id: 'c1', move: { status: 'done' } }]);
    expect(write).toHaveBeenLastCalledWith({ kind: 'move', id: 'c1', move: { status: 'done' } });
    w.patchItems([
      { id: 'c1', patch: { type: 'work' } },
      { id: 'c1', patch: { set: { title: 'U' } } },
    ]);
    expect(write).toHaveBeenLastCalledWith({
      kind: 'patches',
      patches: [
        { id: 'c1', patch: { type: 'work', set: { 'f-app': 'API' } } },
        { id: 'c1', patch: { set: { title: 'U' } } },
      ],
    });
    w.patchItems([{ id: 'c1', patch: { type: 'work' } }]);
    expect(write).toHaveBeenLastCalledWith({
      kind: 'patch',
      id: 'c1',
      patch: { type: 'work', set: { 'f-app': 'API' } },
    });
  });

  it('sends a write that changes no type as it was', () => {
    const { write, w } = writes();
    const patch = { set: { title: 'U' } };
    void w.patchItem('c1', patch);
    expect(write).toHaveBeenLastCalledWith({ kind: 'patch', id: 'c1', patch });
  });
});
