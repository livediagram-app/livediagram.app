// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createShape, type ShapeElement } from '@liveplanner/project';
import {
  PLAN_COLUMNS_MAX,
  presetSetup,
  statusColumn,
  type PlanBoardSetup,
} from '@liveplanner/items';
import { ADDED_TINT_MS, BoardColumnsSection, columnsInsertAfter } from './BoardColumnsSection';
import {
  subscribeColumnSettingsRequest,
  takeColumnSettingsRequest,
} from './column-settings-request';

// docs/specs/026-plan/plan-board.md "The board's own settings": the Columns section lists the board's columns and
// adds one from an existing status or a new name, at the end (before a done column that ends the board).
const plan: Record<string, unknown> = {};
vi.mock('./PlanContext', () => ({ usePlan: () => plan }));
const track = vi.fn<typeof import('./track-board-setup').trackSetup>();
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
  const updateBoard = vi.fn<(elementId: string, setup: PlanBoardSetup) => void>();
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
  const statuses = () => updateBoard.mock.lastCall?.[1].columns.map((c) => c.status);
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
  it('adds after the last column, or before the done columns that end the board', () => {
    const noDone = { ...kanban, columns: kanban.columns.map((c) => ({ ...c, done: false })) };
    expect(columnsInsertAfter(noDone)).toBe('done');
    expect(columnsInsertAfter(kanban)).toBe('doing');
    // Done and Won't Do both end it.
    const wont = { ...kanban, columns: [...kanban.columns, statusColumn('wont', 'Won’t Do')] };
    expect(columnsInsertAfter({ ...wont, doneColumnId: undefined })).toBe('doing');
    // Every column done: after the first.
    expect(columnsInsertAfter({ ...kanban, doneColumnId: 'todo' })).toBe('todo');
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
    expect(statuses()?.[2]).toMatch(/^qa~/);
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
      act(() => {
        vi.advanceTimersByTime(ADDED_TINT_MS);
      });
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

// docs/specs/026-plan/plan-board.md "Suggested statuses": with no existing status left to add, the common ones.
describe('BoardColumnsSection suggested statuses', () => {
  const lone: PlanBoardSetup = { ...kanban, columns: [statusColumn('todo', 'To Do')] };
  delete (lone as { doneColumnId?: string }).doneColumnId;
  const only = { statusNames: new Map([['todo', 'To Do']]) };

  it('adds one at the end as a new status, its own part in telemetry', () => {
    const { statuses, updateBoard } = show(lone, only);
    fireEvent.click(screen.getByRole('button', { name: 'Add In Progress' }));
    expect(statuses()).toHaveLength(2);
    expect(statuses()?.[1]).toMatch(/^in-progress~/);
    expect(updateBoard.mock.lastCall?.[1].columns[1]?.name).toBe('In Progress');
    expect(track).toHaveBeenCalledWith('ColumnAddedSuggested');
  });

  it('adds them all in order with Add All, as one change', () => {
    const { updateBoard } = show(lone, only);
    fireEvent.click(screen.getByRole('button', { name: 'Add All' }));
    expect(updateBoard).toHaveBeenCalledTimes(1);
    expect(updateBoard.mock.lastCall?.[1].columns.map((c) => c.name)).toEqual([
      'To Do',
      'Backlog',
      'In Progress',
      'In Review',
      'Done',
    ]);
  });

  it('suggests nothing while the project has a status the board lacks', () => {
    show(kanban);
    expect(screen.queryByText('Suggested Statuses')).toBeNull();
  });

  it('shows no suggestion to someone who may not edit (a Participant or a Viewer)', () => {
    show(lone, { ...only, canEdit: false });
    expect(screen.queryByText('Suggested Statuses')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Add Backlog' })).toBeNull();
  });
});
