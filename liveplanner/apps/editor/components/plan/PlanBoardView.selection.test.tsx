// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ITEM_TYPES, presetSetup, type Item } from '@liveplanner/items';
import type { ShapeElement } from '@liveplanner/project';
import { PlanBoardView } from './PlanBoardView';
import { PlanProvider, type PlanContextValue } from './PlanContext';
import { createSelectionStore } from '@liveworkspace/workbench/lib/selection-store';
import { SelectionStoreProvider } from '@liveworkspace/workbench/hooks/canvas/useSelectionStore';

// docs/specs/026-plan/plan-board.md "Several cards at once": Cmd/Ctrl-click, Shift-click and Shift+Space pick cards,
// the bar shows while some are picked, Shift+Right moves them all, Delete trashes them; a Viewer picks nothing.
vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver;

afterEach(() => {
  cleanup();
  localStorage.clear();
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
const cards = [item('i1', 1, 'todo'), item('i2', 2, 'todo'), item('i3', 3, 'todo')];

const plan = (over: Partial<PlanContextValue> = {}) =>
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
    moveItems: vi.fn(),
    patchItems: vi.fn(),
    trashItem: vi.fn(),
    trashItems: vi.fn((ids: readonly string[]) => ids.length),
    updateBoard: vi.fn(),
    createTypeForBoard: vi.fn(),
    announce: vi.fn(),
    setDragging: vi.fn(),
    ...over,
  }) as unknown as PlanContextValue & Record<string, ReturnType<typeof vi.fn>>;

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

const draw = (value: PlanContextValue) =>
  render(
    <SelectionStoreProvider store={createSelectionStore()}>
      <PlanProvider value={value}>
        <PlanBoardView element={element} />
      </PlanProvider>
    </SelectionStoreProvider>,
  );
const cardEl = (key: number) =>
  screen.getByRole('listitem', { name: new RegExp(`Card ${key}\\b`) });
const press = (key: number, mods: Partial<PointerEventInit> = {}) =>
  fireEvent.pointerDown(cardEl(key), { button: 0, pointerId: 1, ...mods });
const bar = () => screen.queryByRole('toolbar', { name: 'Selected cards' });

describe('selecting cards on a board', () => {
  it('picks with Cmd/Ctrl-click and Shift-click, rings them, and shows the bar', () => {
    const p = plan();
    draw(p);
    press(1, { metaKey: true });
    expect(cardEl(1).getAttribute('data-selected')).toBe('true');
    expect(bar()?.textContent).toContain('1 card selected');
    press(3, { shiftKey: true });
    expect(bar()?.textContent).toContain('3 cards selected');
    press(2, { ctrlKey: true });
    expect(bar()?.textContent).toContain('2 cards selected');
    expect(p.openItem).not.toHaveBeenCalled();
    // A plain press on a card not picked lets the selection go.
    press(2);
    expect(bar()).toBeNull();
  });

  it('moves the group a column with Shift+Right, and trashes it with Delete', () => {
    const p = plan();
    draw(p);
    fireEvent.keyDown(cardEl(1), { key: ' ', shiftKey: true });
    fireEvent.keyDown(cardEl(2), { key: ' ', shiftKey: true });
    expect(bar()?.textContent).toContain('2 cards selected');
    fireEvent.keyDown(cardEl(1), { key: 'ArrowRight', shiftKey: true });
    expect(p.moveItems).toHaveBeenCalledWith([
      { id: 'i1', move: { status: 'doing', before: null } },
      { id: 'i2', move: { status: 'doing', after: 'i1' } },
    ]);
    fireEvent.keyDown(cardEl(1), { key: 'Delete' });
    expect(p.trashItems).toHaveBeenCalledWith(['i1', 'i2']);
    expect(bar()).toBeNull();
  });

  it('starts select mode from a card’s menu, where a press picks rather than opens', () => {
    const p = plan({ canEdit: false });
    draw(p);
    fireEvent.contextMenu(cardEl(1), { clientX: 10, clientY: 10 });
    fireEvent.click(screen.getByRole('button', { name: 'Select' }));
    expect(bar()?.textContent).toContain('1 card selected');
    // A Participant's bar has no Archive or Move to Trash.
    expect(screen.queryByRole('button', { name: 'Move to Trash' })).toBeNull();
    press(2);
    expect(bar()?.textContent).toContain('2 cards selected');
    expect(p.openItem).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Clear Selection' }));
    expect(bar()).toBeNull();
  });

  it('gives a Viewer no selection', () => {
    const p = plan({ canEdit: false, canEditCards: false });
    draw(p);
    press(1, { metaKey: true });
    fireEvent.keyDown(cardEl(1), { key: ' ', shiftKey: true });
    expect(bar()).toBeNull();
    expect(cardEl(1).getAttribute('data-selected')).toBeNull();
  });
});
