// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createShape, type ShapeElement } from '@liveplanner/project';
import {
  presetSetup,
  statusColumn,
  type ItemTypeDef,
  type PlanBoardSetup,
} from '@liveplanner/items';
import { BoardConfigureDialog } from './BoardConfigureDialog';

// jsdom has no ResizeObserver; the dialog's animated height measures itself with one.
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver;

// docs/specs/026-plan/plan-board.md "Configure": presets on the home, a tile per part opening its panel.
const plan: Record<string, unknown> = {};
vi.mock('@/components/plan/PlanContext', () => ({ usePlan: () => plan }));
const track = vi.fn();
vi.mock('@/components/plan/track-board-setup', () => ({
  trackSetup: (p: string) => {
    track(p);
  },
}));
let tabKind = 'board';
vi.mock('@/hooks/plan/plan-cover-store', () => ({ usePlanTabKind: () => tabKind }));
afterEach(() => {
  cleanup();
  track.mockReset();
  tabKind = 'board';
});

const task = {
  id: 'task',
  label: 'Task',
  newTitle: 'Task',
  glyph: 'item',
  color: '#000',
  fields: ['title', 'status', 'assignee', 'priority', 'due'],
} as ItemTypeDef;
const { addTypes: _all, ...kanban } = presetSetup('kanban');
const setup: PlanBoardSetup = {
  ...kanban,
  swimlaneBy: 'none',
  columns: [statusColumn('todo', 'To Do'), statusColumn('done', 'Done')],
};

function show(board: PlanBoardSetup = setup, extra: Record<string, unknown> = {}) {
  for (const k of Object.keys(plan)) delete plan[k];
  const updateBoard = vi.fn();
  const newFormFor = vi.fn();
  Object.assign(
    plan,
    { canEdit: true, types: [task], items: new Map(), updateBoard, newFormFor },
    extra,
  );
  const element = { ...createShape('plan-board', 0, 0), id: 'b', planBoard: board } as ShapeElement;
  const onClose = vi.fn();
  render(<BoardConfigureDialog element={element} onClose={onClose} />);
  return { updateBoard, newFormFor, onClose };
}

describe('BoardConfigureDialog', () => {
  it('applies a preset as one board edit', () => {
    const { updateBoard } = show();
    expect(screen.getByRole('dialog', { name: 'Configure board' })).toBeTruthy();
    expect(
      screen.getByRole('button', { name: /Simple Columns/ }).getAttribute('aria-pressed'),
    ).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: /Most Urgent First/ }));
    expect(updateBoard).toHaveBeenCalledWith(
      'b',
      expect.objectContaining({
        sortBy: [
          { field: 'priority', dir: 'desc' },
          { field: 'due', dir: 'asc' },
        ],
      }),
    );
    expect(track).toHaveBeenCalledWith('Preset.urgent');
  });

  it('says how each part stands and opens its panel, then back', () => {
    show({
      ...setup,
      swimlaneBy: 'assignee',
      sortBy: [{ field: 'due', dir: 'asc' }],
      cardSize: 'minimal',
    });
    expect(screen.getByText('2 columns')).toBeTruthy();
    expect(screen.getByText('A row per person')).toBeTruthy();
    expect(screen.getByText('Due Date')).toBeTruthy();
    expect(screen.getByText('All 1 card type')).toBeTruthy();
    expect(screen.getByText('Minimal cards')).toBeTruthy();
    const tile = screen.getByRole('button', { name: /Sort Cards/ });
    fireEvent.click(tile);
    expect(tile.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByRole('dialog', { name: 'Sort Cards' })).toBeTruthy();
    expect(screen.getByText('Sort By')).toBeTruthy();
    // Pressed again, it closes its popover; Configure Board stays.
    fireEvent.click(tile);
    expect(screen.queryByRole('dialog', { name: 'Sort Cards' })).toBeNull();
    expect(screen.getByText('Suggested for This Board')).toBeTruthy();
  });

  it('names partial type support and an unsorted board', () => {
    const other = { ...task, id: 'bug', label: 'Bug' };
    show({ ...setup, addTypes: ['task'] }, { types: [task, other] });
    expect(screen.getByText('1 of 2 card types')).toBeTruthy();
    expect(screen.getByText('In the order you put them')).toBeTruthy();
  });

  it('starts a form for the board from the header and closes', () => {
    const { newFormFor, onClose } = show();
    fireEvent.click(screen.getByRole('button', { name: /Create Form/ }));
    expect(onClose).toHaveBeenCalled();
    expect(newFormFor).toHaveBeenCalledWith('b');
  });

  it('offers no form off a Board tab, and nothing to a viewer', () => {
    tabKind = 'canvas';
    show();
    expect(screen.queryByRole('button', { name: /Create Form/ })).toBeNull();
    cleanup();
    show(setup, { canEdit: false });
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
