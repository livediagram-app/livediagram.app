// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ITEM_TYPES, presetSetup, type Item } from '@liveplanner/items';
import type { ShapeElement } from '@liveplanner/project';
import { PlanBoardView } from './PlanBoardView';
import { PlanProvider, type PlanContextValue } from './PlanContext';
import { createSelectionStore } from '@liveworkspace/workbench/lib/selection-store';
import { SelectionStoreProvider } from '@liveworkspace/workbench/hooks/canvas/useSelectionStore';
import { planBoardTarget } from '@/hooks/plan/plan-board-targets';

// docs/specs/026-plan/plan-board.md "A column's own settings" (a right-click on a column's background opens its
// settings, for an Editor) and "Add card steps aside" (a cell's Add card row folds while a drop gap shows there).
vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
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

const cards = [item('i1', 1, 'todo'), item('i2', 2, 'doing'), item('i3', 3, 'review')];

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
  id: 'b-menu',
  type: 'shape',
  shape: 'plan-board',
  x: 0,
  y: 0,
  width: 1400,
  height: 600,
  planBoard: { ...presetSetup('kanban'), widgets: [] },
} as unknown as ShapeElement;

// The board inside a parent that stands for the canvas: its own right-click is the element or tab menu.
const draw = (value = plan()) => {
  const outer = vi.fn();
  render(
    <div onContextMenu={outer}>
      <SelectionStoreProvider store={createSelectionStore()}>
        <PlanProvider value={value}>
          <PlanBoardView element={element} />
        </PlanProvider>
      </SelectionStoreProvider>
    </div>,
  );
  return { outer };
};

const cell = (status: string) =>
  document.querySelector<HTMLElement>(`[data-plan-status="${status}"]:not([data-plan-strip])`)!;
const addRow = (status: string) => cell(status).querySelector<HTMLElement>('[data-cell-add-row]')!;

describe('a right-click on a column’s background', () => {
  it('opens that column’s settings for an Editor, never the canvas’s menu or the browser’s', () => {
    const { outer } = draw();
    expect(screen.queryByRole('dialog', { name: 'Review column' })).toBeNull();
    const shown = fireEvent.contextMenu(cell('review'), { clientX: 300, clientY: 200 });
    // Default prevented (no browser menu) and stopped (no element or tab menu).
    expect(shown).toBe(false);
    expect(outer).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog', { name: 'Review column' })).toBeTruthy();
    // The cog shows itself pressed, as when it is pressed.
    expect(
      screen.getByRole('button', { name: 'Review column settings' }).getAttribute('aria-expanded'),
    ).toBe('true');
  });

  it('opens it from the Add card row too, and never selects the column’s name', () => {
    draw();
    fireEvent.contextMenu(cell('doing').querySelector('[data-add-card-trigger]')!);
    expect(screen.getByRole('dialog', { name: 'In Progress column' })).toBeTruthy();
    const name = screen.getByRole('dialog', { name: 'In Progress column' }).querySelector('input');
    if (name instanceof HTMLInputElement && document.activeElement === name)
      expect(name.selectionStart).toBe(name.selectionEnd);
  });

  it('keeps a card’s own menu on a card', () => {
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe() {}
        disconnect() {}
      },
    );
    const { outer } = draw();
    fireEvent.contextMenu(document.querySelector('[data-plan-card="i3"]')!, {
      clientX: 300,
      clientY: 200,
    });
    expect(screen.getByText('Duplicate')).toBeTruthy();
    expect(screen.queryByRole('dialog', { name: 'Review column' })).toBeNull();
    expect(outer).not.toHaveBeenCalled();
  });

  it('does nothing new for a Viewer: the right-click goes on as before', () => {
    const { outer } = draw(plan({ canEdit: false, canEditCards: false }));
    const shown = fireEvent.contextMenu(cell('review'));
    expect(shown).toBe(true);
    expect(outer).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

describe('a cell’s Add card row while a drop gap shows there', () => {
  it('folds (inert, faded, its row closed) and comes back once the gap leaves', () => {
    draw();
    const target = planBoardTarget('b-menu')!;
    expect(addRow('review').dataset.cellAddRow).toBe('shown');
    act(() =>
      target.hover({
        itemId: '',
        slot: { status: 'review', laneKey: '', beforeId: null },
        height: 56,
      }),
    );
    const folded = addRow('review');
    expect(folded.dataset.cellAddRow).toBe('folded');
    expect(folded.style.gridTemplateRows).toBe('0fr');
    expect(folded.style.opacity).toBe('0');
    expect(folded.style.marginTop).toBe('-8px');
    expect(folded.hasAttribute('inert')).toBe(true);
    // Only the cell the gap is in.
    expect(addRow('doing').dataset.cellAddRow).toBe('shown');
    act(() => target.hover(null));
    const back = addRow('review');
    expect(back.dataset.cellAddRow).toBe('shown');
    expect(back.style.gridTemplateRows).toBe('1fr');
    expect(back.hasAttribute('inert')).toBe(false);
  });
});

describe('the Add card row and the drop gap', () => {
  it('move on one length and easing, so the gap closing and the row returning are one motion', async () => {
    const { GAP_MOTION_MS, GAP_MOTION_EASE } = await import('./useGapMotion');
    draw();
    const row = addRow('review');
    expect(row.className).toContain(`duration-[${GAP_MOTION_MS}ms]`);
    expect(row.className).toContain(`ease-[${GAP_MOTION_EASE.replace(/ /g, '')}]`);
  });
});
