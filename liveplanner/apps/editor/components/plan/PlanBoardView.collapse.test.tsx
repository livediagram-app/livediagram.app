// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ITEM_TYPES, presetSetup, type Item } from '@liveplanner/items';
import type { ShapeElement } from '@liveplanner/project';
import { PlanBoardView } from './PlanBoardView';
import { PlanProvider, type PlanContextValue } from './PlanContext';
import { createSelectionStore } from '@liveworkspace/workbench/lib/selection-store';
import { SelectionStoreProvider } from '@liveworkspace/workbench/hooks/canvas/useSelectionStore';
import { dropSlotAt } from '@/hooks/plan/usePlanCardDrag';
import { boardCollapsedKey } from './board-collapse';

// docs/specs/026-plan/plan-board.md "Collapse Column": any column collapses to a strip and expands again, for each
// person (a Viewer too), remembered per board on this browser; a strip takes drops; a phone offers none and shows every
// column open.
const viewport = vi.hoisted(() => ({ mobile: false }));
vi.mock('@liveworkspace/workbench/hooks/ui/useIsMobileViewport', () => ({
  useIsMobileViewport: () => viewport.mobile,
}));

afterEach(() => {
  cleanup();
  localStorage.clear();
  viewport.mobile = false;
});

const item = (id: string, key: number, status: string, assignee?: string): Item =>
  ({
    id,
    key,
    type: 'task',
    fields: {
      title: `Card ${key}`,
      status,
      ...(assignee ? { assignee: { id: assignee, name: 'Sam', color: '#7c3aed' } } : {}),
    },
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

// What this browser keeps for the board.
const stored = () =>
  JSON.parse(localStorage.getItem(boardCollapsedKey('b1'))!) as {
    columns: string[];
    lanes: string[];
  };

const VIEWER = { canEdit: false, canEditCards: false } as const;

const element = (lanes = false): ShapeElement =>
  ({
    id: 'b1',
    type: 'shape',
    shape: 'plan-board',
    x: 0,
    y: 0,
    width: 1400,
    height: 600,
    planBoard: {
      ...presetSetup('kanban'),
      widgets: [],
      ...(lanes ? { swimlaneBy: 'assignee' } : {}),
    },
  }) as unknown as ShapeElement;

const draw = (value = plan(), lanes = false) =>
  render(
    <SelectionStoreProvider store={createSelectionStore()}>
      <PlanProvider value={value}>
        <PlanBoardView element={element(lanes)} />
      </PlanProvider>
    </SelectionStoreProvider>,
  );

const collapseButton = (name: string) =>
  screen.queryByRole('button', { name: `Collapse Column, ${name}` });
const expandButtons = (name: string) =>
  screen.queryAllByRole('button', { name: new RegExp(`^Expand Column, ${name}`) });

describe('Collapse Column', () => {
  it('lets a Viewer collapse a column to a strip and expand it, remembered on this browser', () => {
    const first = draw(plan(VIEWER));
    // No cogs for a Viewer, but the chevron.
    expect(document.querySelector('[data-column-cog]')).toBeNull();
    fireEvent.click(collapseButton('In Progress')!);
    // The strip: its head's chevron and its cell, the count and name; the column's cards not drawn.
    expect(expandButtons('In Progress')).toHaveLength(2);
    expect(
      screen.getByRole('button', { name: 'Expand Column, In Progress, 1 of a WIP limit of 3' }),
    ).toBeTruthy();
    expect(screen.queryByText('Card 2')).toBeNull();
    expect(collapseButton('In Progress')).toBeNull();
    // Focus follows to the strip's chevron.
    expect(document.activeElement?.getAttribute('aria-label')).toBe('Expand Column, In Progress');
    expect(stored().columns).toEqual(['doing']);
    first.unmount();

    // A reload keeps it; the strip's cell expands it.
    draw(plan(VIEWER));
    expect(screen.queryByText('Card 2')).toBeNull();
    fireEvent.click(
      screen.getByRole('button', { name: 'Expand Column, In Progress, 1 of a WIP limit of 3' }),
    );
    expect(screen.getByText('Card 2')).toBeTruthy();
    expect(expandButtons('In Progress')).toHaveLength(0);
    expect(document.activeElement?.getAttribute('aria-label')).toBe('Collapse Column, In Progress');
    expect(localStorage.getItem(boardCollapsedKey('b1'))).toBeNull();
  });

  it("offers Collapse Column in an Editor's cog, which closes as the column collapses", () => {
    draw();
    fireEvent.click(screen.getByRole('button', { name: 'Review column settings' }));
    fireEvent.click(screen.getByRole('button', { name: 'Collapse Column' }));
    expect(screen.queryByRole('dialog', { name: 'Review column' })).toBeNull();
    expect(expandButtons('Review')).toHaveLength(2);
    expect(screen.queryByText('Card 3')).toBeNull();
    // The strip's head chevron expands it too.
    fireEvent.click(screen.getByRole('button', { name: 'Expand Column, Review' }));
    expect(screen.getByText('Card 3')).toBeTruthy();
  });

  it('takes a drop on a strip: its cell is a drop target at the end of the column', () => {
    localStorage.setItem(boardCollapsedKey('b1'), JSON.stringify({ columns: ['done'] }));
    draw();
    const cell = document.querySelector<HTMLElement>('[data-plan-strip][data-plan-status="done"]')!;
    const board = document.querySelector<HTMLElement>('[data-plan-board]')!;
    const hits = vi.fn(() => [cell.firstElementChild!, cell, board]);
    Object.defineProperty(document, 'elementsFromPoint', { configurable: true, value: hits });
    expect(dropSlotAt(board, 10, 10, 'i1')).toEqual({
      status: 'done',
      laneKey: '',
      beforeId: null,
    });
  });

  it('gives each open swimlane its part of the strip, with that row’s count', () => {
    const value = plan({
      items: new Map(
        [item('i1', 1, 'doing', 'sam'), item('i2', 2, 'doing'), item('i3', 3, 'doing')].map((c) => [
          c.id,
          c,
        ]),
      ),
    });
    localStorage.setItem(boardCollapsedKey('b1'), JSON.stringify({ columns: ['doing'] }));
    draw(value, true);
    const cells = document.querySelectorAll<HTMLElement>(
      '[data-plan-strip][data-plan-status="doing"]',
    );
    expect(cells.length).toBeGreaterThan(1);
    expect(
      screen.getByRole('button', { name: /^Expand Column, In Progress, No assignee, 2 items$/ }),
    ).toBeTruthy();
    // A swimlane shut is remembered with the columns.
    fireEvent.click(screen.getByRole('button', { name: /No assignee/, expanded: true }));
    expect(stored().lanes).toHaveLength(1);
  });

  it('passes the arrow keys over a collapsed column', () => {
    localStorage.setItem(boardCollapsedKey('b1'), JSON.stringify({ columns: ['doing'] }));
    draw();
    const first = document.querySelector<HTMLElement>('[data-plan-card="i1"]')!;
    act(() => first.focus());
    fireEvent.keyDown(first, { key: 'ArrowRight' });
    expect(document.activeElement).toBe(document.querySelector('[data-plan-card="i3"]'));
  });

  it('offers no collapsing on a phone, and shows a column collapsed elsewhere open', () => {
    viewport.mobile = true;
    localStorage.setItem(boardCollapsedKey('b1'), JSON.stringify({ columns: ['doing'] }));
    draw();
    expect(screen.getByText('Card 2')).toBeTruthy();
    expect(document.querySelector('[data-plan-strip]')).toBeNull();
    expect(collapseButton('To Do')).toBeNull();
  });
});
