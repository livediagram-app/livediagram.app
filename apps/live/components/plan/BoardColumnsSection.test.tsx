// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createShape, type ShapeElement } from '@livediagram/document';
import {
  PLAN_COLUMNS_MAX,
  presetSetup,
  statusColumn,
  type PlanBoardSetup,
} from '@livediagram/items';
import { ADDED_TINT_MS, BoardColumnsSection, columnsInsertAfter } from './BoardColumnsSection';
import {
  subscribeColumnSettingsRequest,
  takeColumnSettingsRequest,
} from './column-settings-request';

// docs/specs/026-plan/plan-board.md "The board's own settings": the Columns section lists the board's columns and
// adds one from an existing status or a new name, at the end (before a done column that ends the board).
const plan: Record<string, unknown> = {};
vi.mock('./PlanContext', () => ({ usePlan: () => plan }));
const track = vi.fn();
vi.mock('./track-board-setup', () => ({ trackSetup: (part: string) => track(part) }));
afterEach(() => {
  cleanup();
  track.mockReset();
});

const kanban: PlanBoardSetup = {
  ...presetSetup('kanban'),
  columns: [
    statusColumn('todo', 'To Do'),
    { ...statusColumn('doing', 'Doing'), wipLimit: 3 },
    statusColumn('done', 'Done'),
  ],
  doneColumnId: 'done',
};

function show(setup: PlanBoardSetup, overrides: Record<string, unknown> = {}) {
  for (const key of Object.keys(plan)) delete plan[key];
  const updateBoard = vi.fn();
  Object.assign(
    plan,
    {
      canEdit: true,
      updateBoard,
      items: new Map(),
      statusNames: new Map([
        ['todo', 'To Do'],
        ['doing', 'Doing'],
        ['done', 'Done'],
        ['review', 'Review'],
      ]),
      statusBoards: [],
    },
    overrides,
  );
  const element = {
    ...createShape('plan-board', 0, 0),
    id: 'board',
    planBoard: setup,
  } as ShapeElement;
  const onClose = vi.fn();
  const { rerender } = render(<BoardColumnsSection element={element} open onClose={onClose} />);
  const statuses = () =>
    (updateBoard.mock.lastCall?.[1] as PlanBoardSetup).columns.map((c) => c.status);
  // The board redrawn with the set-up it was just given.
  const redraw = () =>
    rerender(
      <BoardColumnsSection
        element={{ ...element, planBoard: updateBoard.mock.lastCall![1] }}
        open
        onClose={onClose}
      />,
    );
  return { updateBoard, onClose, statuses, redraw };
}

describe('columnsInsertAfter', () => {
  it('adds after the last column, or before a done column that ends the board', () => {
    expect(columnsInsertAfter({ ...kanban, doneColumnId: undefined })).toBe('done');
    expect(columnsInsertAfter(kanban)).toBe('doing');
    expect(columnsInsertAfter({ ...kanban, doneColumnId: 'todo' })).toBe('done');
    expect(
      columnsInsertAfter({ columns: [statusColumn('done', 'Done')], doneColumnId: 'done' }),
    ).toBe('done');
    expect(columnsInsertAfter({ columns: [] })).toBeNull();
  });
});

describe('BoardColumnsSection', () => {
  it('lists the columns left to right with their WIP and Done pills', () => {
    show(kanban);
    const rows = screen.getAllByRole('button', { name: /^Open .* settings$/ });
    expect(rows.map((r) => r.getAttribute('aria-label'))).toEqual([
      'Open To Do settings',
      'Open Doing settings',
      'Open Done settings',
    ]);
    expect(rows[1]!.textContent).toContain('WIP 3');
    expect(rows[2]!.textContent).toContain('Done');
  });

  it('opens a column’s own settings from its row, closing the menu', () => {
    const { onClose } = show(kanban);
    const heard = vi.fn();
    const off = subscribeColumnSettingsRequest(heard);
    fireEvent.click(screen.getByRole('button', { name: 'Open Doing settings' }));
    off();
    expect(onClose).toHaveBeenCalled();
    expect(heard).toHaveBeenCalled();
    expect(takeColumnSettingsRequest('doing')).toBe(true);
  });

  it('adds an existing status before the done column', () => {
    const { statuses } = show(kanban);
    fireEvent.click(screen.getByRole('option', { name: /Review/ }));
    expect(statuses()).toEqual(['todo', 'doing', 'review', 'done']);
    expect(track).toHaveBeenCalledWith('ColumnAddedExisting');
  });

  it('adds a new status by name, with a status of its own', () => {
    const { statuses } = show(kanban);
    fireEvent.change(screen.getByRole('combobox', { name: 'New column name' }), {
      target: { value: 'QA' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Add Column' }));
    expect(statuses()[2]).toMatch(/^qa~/);
    expect(statuses()).toHaveLength(4);
    expect(track).toHaveBeenCalledWith('ColumnAdded');
  });

  it('tints the column just added for a moment', () => {
    vi.useFakeTimers();
    try {
      const { redraw } = show(kanban);
      fireEvent.click(screen.getByRole('option', { name: /Review/ }));
      redraw();
      const row = () => screen.getByRole('button', { name: 'Open Review settings' });
      expect(row().className).toContain('bg-brand-50');
      act(() => vi.advanceTimersByTime(ADDED_TINT_MS));
      expect(row().className).not.toContain('bg-brand-50');
    } finally {
      vi.useRealTimers();
    }
  });

  it('says a board is full at the column limit, offering no picker', () => {
    const columns = Array.from({ length: PLAN_COLUMNS_MAX }, (_, i) =>
      statusColumn(`s${i}`, `S${i}`),
    );
    show({ ...kanban, columns, doneColumnId: undefined });
    expect(screen.getByRole('status').textContent).toBe(
      `A board holds up to ${PLAN_COLUMNS_MAX} columns.`,
    );
    expect(screen.queryByRole('button', { name: 'Add Column' })).toBeNull();
  });

  it('shows nothing to someone who may not edit', () => {
    show(kanban, { canEdit: false });
    expect(screen.queryByRole('button', { name: /^Open .* settings$/ })).toBeNull();
  });
});
