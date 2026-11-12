// @vitest-environment jsdom
import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ITEM_TYPES, presetSetup, type Item } from '@liveplanner/items';
import type { ShapeElement } from '@liveplanner/project';
import { PlanBoardView } from './PlanBoardView';
import { PlanProvider, type PlanContextValue } from './PlanContext';
import { createSelectionStore } from '@liveworkspace/workbench/lib/selection-store';
import { SelectionStoreProvider } from '@liveworkspace/workbench/hooks/canvas/useSelectionStore';

// docs/specs/026-plan/plan-board.md "On a phone": a tap on a card in a neighbouring column brings that column to the
// centre and leaves the card shut; a tap on a card in the column in focus opens it, as before.
vi.mock('@liveworkspace/workbench/hooks/ui/useIsMobileViewport', () => ({
  useIsMobileViewport: () => true,
}));
vi.mock('@/hooks/plan/useBoardMaximised', () => ({
  useBoardMaximised: () => ({ maximised: false, filled: true }),
}));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const item = (id: string, key: number, status: string): Item =>
  ({
    id,
    key,
    type: 'task',
    fields: { title: `Card ${key}`, status },
    rank: `a${key}`,
    createdAt: 0,
    updatedAt: 0,
  }) as unknown as Item;

const cards = [item('i1', 1, 'todo'), item('i2', 2, 'doing')];

const plan = (over: Partial<PlanContextValue> = {}): PlanContextValue =>
  ({
    items: new Map(cards.map((c) => [c.id, c])),
    types: ITEM_TYPES,
    status: 'ready',
    self: null,
    people: [],
    canEdit: true,
    canEditCards: true,
    canVote: true,
    presence: new Map(),
    statusNames: new Map(),
    statusBoards: new Map(),
    openItemId: null,
    retry: vi.fn(),
    openItem: vi.fn(),
    openNewItem: vi.fn(),
    addItem: vi.fn(),
    moveItem: vi.fn(),
    updateBoard: vi.fn(),
    createTypeForBoard: vi.fn(),
    announce: vi.fn(),
    setDragging: vi.fn(),
    ...over,
  }) as unknown as PlanContextValue;

const element = {
  id: 'b1',
  type: 'shape',
  shape: 'plan-board',
  x: 0,
  y: 0,
  width: 1400,
  height: 600,
  planBoard: { ...presetSetup('kanban'), widgets: [] },
} as unknown as ShapeElement;

// A 390 px view with To Do in focus (its cards centred) and In Progress peeking in at the right.
function draw(value: PlanContextValue) {
  render(
    <SelectionStoreProvider store={createSelectionStore()}>
      <PlanProvider value={value}>
        <PlanBoardView element={element} />
      </PlanProvider>
    </SelectionStoreProvider>,
  );
  const body = document.querySelector<HTMLElement>('[data-plan-body]')!;
  Object.defineProperties(body, {
    clientWidth: { value: 390, configurable: true },
    scrollWidth: { value: 1300, configurable: true },
  });
  body.scrollTo = vi.fn();
  vi.spyOn(body, 'getBoundingClientRect').mockReturnValue({ left: 0, width: 390 } as DOMRect);
  const place = (sel: string, left: number) =>
    document.querySelectorAll<HTMLElement>(sel).forEach((el) =>
      vi.spyOn(el, 'getBoundingClientRect').mockReturnValue({
        left,
        width: 302,
        top: 0,
        bottom: 80,
        height: 80,
        right: left + 302,
      } as DOMRect),
    );
  place('[data-plan-card="i1"], [data-plan-column="todo"]', 44);
  place('[data-plan-card="i2"], [data-plan-column="doing"]', 358);
  return {
    body,
    card: (id: string) => document.querySelector<HTMLElement>(`[data-plan-card="${id}"]`)!,
  };
}

const tap = (el: HTMLElement) => {
  fireEvent.pointerDown(el, {
    button: 0,
    pointerId: 1,
    pointerType: 'touch',
    clientX: 10,
    clientY: 10,
  });
  fireEvent.pointerUp(window, { button: 0, pointerId: 1, clientX: 10, clientY: 10 });
};

describe('a tap on a phone board, one column a screen', () => {
  it('brings a neighbouring column in instead of opening its card', () => {
    const value = plan();
    const { body, card } = draw(value);
    tap(card('i2'));
    expect(value.openItem).not.toHaveBeenCalled();
    expect(body.scrollTo).toHaveBeenCalledWith(expect.objectContaining({ behavior: 'smooth' }));
  });

  it('opens a card in the column in focus', () => {
    const value = plan();
    const { body, card } = draw(value);
    tap(card('i1'));
    expect(value.openItem).toHaveBeenCalledWith('i1');
    expect(body.scrollTo).not.toHaveBeenCalled();
  });

  it('does the same for a Viewer, whose press opens a card at once', () => {
    const value = plan({ canEdit: false, canEditCards: false });
    const { body, card } = draw(value);
    fireEvent.pointerDown(card('i2'), { button: 0, pointerId: 1, pointerType: 'touch' });
    expect(value.openItem).not.toHaveBeenCalled();
    expect(body.scrollTo).toHaveBeenCalled();
    fireEvent.pointerDown(card('i1'), { button: 0, pointerId: 2, pointerType: 'touch' });
    expect(value.openItem).toHaveBeenCalledWith('i1');
  });
});
