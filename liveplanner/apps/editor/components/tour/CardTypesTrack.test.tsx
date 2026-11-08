// @vitest-environment jsdom

// A board's Card Types track (docs/specs/026-plan/plan-tour.md "Boards: Card Types"): make a type, give it a field, add
// a practice card of it; the finish keeps the type or puts the plan back.

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Item, ItemTypeDef, PlanBoardSetup } from '@liveplanner/items';
import { CardTypesTrack } from './CardTypesTrack';

const track = vi.hoisted(() => vi.fn());
vi.mock('@/lib/telemetry', () => ({ track }));
const ctx = vi.hoisted(() => ({ current: {} as Record<string, unknown> }));
vi.mock('@/app/project/[id]/EditorContext', () => ({
  useEditorContext: () => ctx.current,
}));

const type = (id: string, fields: string[] = ['title']): ItemTypeDef => ({
  id,
  label: id === 'risk' ? 'Risk' : id,
  newTitle: '',
  glyph: 'item',
  color: '#000',
  fields,
});
const SETUP = {
  title: 'Board',
  columns: [
    { id: 'todo', status: 'todo', name: 'To Do' },
    { id: 'done', status: 'done', name: 'Done' },
  ],
  swimlaneBy: 'none',
  cardFields: [],
  hideWriting: false,
} as unknown as PlanBoardSetup;

type Plan = {
  context: {
    types: ItemTypeDef[];
    items: Map<string, Item>;
    updateBoard: ReturnType<typeof vi.fn>;
    itemTypes: { deleteType: ReturnType<typeof vi.fn> };
  };
  practiceIds: ReadonlySet<string>;
  capturePractice: ReturnType<typeof vi.fn>;
  endPractice: ReturnType<typeof vi.fn>;
};
let plan: Plan;
const onEnd = vi.fn();

// One plan object for the test, as the editor keeps it; a change is made on it, then the track re-renders.
const editor = (setup: PlanBoardSetup = SETUP) => {
  ctx.current = { plan, activeTab: { id: 'tab1', elements: [{ id: 'b0', planBoard: setup }] } };
};
const strip = () => screen.getByRole('region', { name: 'Card Types' });

beforeEach(() => {
  plan = {
    context: {
      types: [type('task')],
      items: new Map(),
      updateBoard: vi.fn(),
      itemTypes: { deleteType: vi.fn() },
    },
    practiceIds: new Set(),
    capturePractice: vi.fn(),
    endPractice: vi.fn(async () => undefined),
  };
  editor();
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  document.body.innerHTML = '';
});

// Runs every mission: makes a Risk type, gives it a field, and adds a practice card of it.
function runToFinish(rerender: (ui: React.ReactElement) => void) {
  // A fresh element each time, so a rerender reads the context afresh.
  const ui = () => <CardTypesTrack boardId="b0" onEnd={onEnd} />;
  plan.context.types = [type('task'), type('risk')];
  rerender(ui());
  fireEvent.click(screen.getByRole('button', { name: 'Next' }));
  plan.context.types = [type('task'), type('risk', ['title', 'due'])];
  rerender(ui());
  fireEvent.click(screen.getByRole('button', { name: 'Next' }));
  const card = { id: 'p1', type: 'risk', key: 0, rank: 'a', fields: {} } as unknown as Item;
  plan.context.items = new Map([['p1', card]]);
  // One already gone from the store is passed over.
  plan.practiceIds = new Set(['p1', 'gone']);
  rerender(ui());
  fireEvent.click(screen.getByRole('button', { name: 'Finish' }));
}

describe('CardTypesTrack', () => {
  it('starts on Make a Card Type, naming the board’s first column later on', () => {
    render(<CardTypesTrack boardId="b0" onEnd={onEnd} />);
    expect(strip().textContent).toContain('Make a Card Type');
    expect(track).toHaveBeenCalledWith('UI', 'View', expect.any(String));
    expect(plan.capturePractice).not.toHaveBeenCalled();
  });

  it('captures a card of the new type added on this board as practice', () => {
    const { rerender } = render(<CardTypesTrack boardId="b0" onEnd={onEnd} />);
    plan.context.types = [type('task'), type('risk')];
    rerender(<CardTypesTrack boardId="b0" onEnd={onEnd} />);
    const match = plan.capturePractice.mock.calls.at(-1)![0] as (c: unknown) => boolean;
    expect(match({ type: 'risk', fields: {}, place: { status: 'todo' } })).toBe(true);
    expect(match({ type: 'task', fields: {}, place: { status: 'todo' } })).toBe(false);
    expect(match({ type: 'risk', fields: {}, place: { status: 'elsewhere' } })).toBe(false);
    expect(match({ type: 'risk', fields: {} })).toBe(false);
    // A board that takes every type needs no change to offer it.
    expect(plan.context.updateBoard).not.toHaveBeenCalled();
  });

  it('adds the new type to a board that names its types', () => {
    const named = { ...SETUP, addTypes: ['task'] } as PlanBoardSetup;
    editor(named);
    const { rerender } = render(<CardTypesTrack boardId="b0" onEnd={onEnd} />);
    plan.context.types = [type('task'), type('risk')];
    rerender(<CardTypesTrack boardId="b0" onEnd={onEnd} />);
    expect(plan.context.updateBoard).toHaveBeenCalledWith('b0', {
      ...named,
      addTypes: ['task', 'risk'],
    });
  });

  it('runs to its finish, and Put It Back deletes the new type and clears the practice card', () => {
    const { rerender } = render(<CardTypesTrack boardId="b0" onEnd={onEnd} />);
    runToFinish(rerender);
    expect(strip().textContent).toContain('Risk is ready.');
    fireEvent.click(screen.getByRole('button', { name: 'Put It Back' }));
    expect(plan.context.itemTypes.deleteType).toHaveBeenCalledWith('risk');
    expect(plan.endPractice).toHaveBeenCalledWith(false);
    expect(track).toHaveBeenCalledWith('UI', 'Selected', 'PlanTourPutBack');
    // The board took every type: nothing to put back on it.
    expect(plan.context.updateBoard).not.toHaveBeenCalled();
    expect(onEnd).toHaveBeenCalledWith('completed');
  });

  it('Put It Back also gives a board that names its types its list as it was', () => {
    const named = { ...SETUP, addTypes: ['task'] } as PlanBoardSetup;
    editor(named);
    const { rerender } = render(<CardTypesTrack boardId="b0" onEnd={onEnd} />);
    // The board as the editor writes it back, with the new type added.
    plan.context.types = [type('task'), type('risk')];
    editor({ ...named, addTypes: ['task', 'risk'] });
    runToFinish(rerender);
    plan.context.updateBoard.mockClear();
    fireEvent.click(screen.getByRole('button', { name: 'Put It Back' }));
    expect(plan.context.updateBoard).toHaveBeenCalledWith('b0', {
      ...named,
      addTypes: ['task'],
    });
  });

  it('Keep leaves the type, still clearing the practice card', () => {
    const { rerender } = render(<CardTypesTrack boardId="b0" onEnd={onEnd} />);
    runToFinish(rerender);
    fireEvent.click(screen.getByRole('button', { name: 'Keep the Type' }));
    expect(plan.context.itemTypes.deleteType).not.toHaveBeenCalled();
    expect(plan.endPractice).toHaveBeenCalledWith(false);
    expect(track).not.toHaveBeenCalledWith('UI', 'Selected', 'PlanTourPutBack');
    expect(onEnd).toHaveBeenCalledWith('completed');
  });

  it('ends as skipped from End, and clears its practice as it goes', () => {
    const { unmount } = render(<CardTypesTrack boardId="b0" onEnd={onEnd} />);
    fireEvent.click(screen.getByRole('button', { name: 'End Card Types' }));
    expect(onEnd).toHaveBeenCalledWith('skipped');
    act(() => unmount());
    expect(plan.endPractice).toHaveBeenCalledWith(false);
  });

  it('draws nothing without its board', () => {
    ctx.current = { plan, activeTab: { id: 'tab1', elements: [] } };
    render(<CardTypesTrack boardId="b0" onEnd={onEnd} />);
    expect(screen.queryByRole('region', { name: 'Card Types' })).toBeNull();
  });
});
