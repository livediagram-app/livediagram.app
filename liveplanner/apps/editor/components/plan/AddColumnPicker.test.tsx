// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { MissingStatus, PlanBoardSetup } from '@liveplanner/items';
import { AddColumnPicker, narrowStatuses } from './AddColumnPicker';
import { cardCount, usedOn } from './ExistingStatusList';

// docs/specs/026-plan/plan-board.md "The column picker".
afterEach(cleanup);

const setup = {
  columns: [{ id: 'doing', status: 'doing', name: 'Doing' }],
} as unknown as PlanBoardSetup;

const TODO: MissingStatus = { status: 'todo', name: 'To do', cards: 4, boards: ['Sprint'] };
const DONE: MissingStatus = {
  status: 'done',
  name: 'Done',
  cards: 1,
  boards: ['Sprint', 'Roadmap'],
  colour: '#16a34a',
};
const BLOCKED: MissingStatus = { status: 'blocked~x', name: 'Blocked', cards: 0, boards: [] };

function show(
  existing: readonly MissingStatus[],
  board: PlanBoardSetup = setup,
  known: ReadonlyMap<string, string> = new Map(),
) {
  const statusNames = new Map([...known, ...existing.map((s) => [s.status, s.name] as const)]);
  const handlers = { onPick: vi.fn(), onPickAll: vi.fn(), onName: vi.fn(), onSuggest: vi.fn() };
  render(
    <AddColumnPicker
      setup={board}
      statusNames={statusNames}
      existing={existing}
      autoFocus
      {...handlers}
    />,
  );
  return handlers;
}

const field = () => screen.getByLabelText('New column name');

describe('AddColumnPicker', () => {
  it('lists the existing statuses with their boards, swatch and card counts', () => {
    show([TODO, DONE, BLOCKED]);
    expect(screen.getByText('Existing Statuses')).toBeTruthy();
    const options = screen.getAllByRole('option');
    expect(options.map((o) => o.getAttribute('data-status'))).toEqual([
      'todo',
      'done',
      'blocked~x',
    ]);
    expect(within(options[0]!).getByText('4 cards')).toBeTruthy();
    expect(within(options[0]!).getByText('On Sprint')).toBeTruthy();
    expect(within(options[1]!).getByText('On Sprint, Roadmap')).toBeTruthy();
    expect(within(options[2]!).getByText('No cards')).toBeTruthy();
    expect(within(options[2]!).getByText('Not on any board')).toBeTruthy();
    expect(field().getAttribute('role')).toBe('combobox');
    expect(document.activeElement).toBe(field());
  });

  it('adds a status on a press, keeping its name', () => {
    const h = show([TODO, DONE]);
    fireEvent.click(screen.getAllByRole('option')[1]!);
    expect(h.onPick).toHaveBeenCalledWith({ status: 'done', name: 'Done' });
  });

  it('moves through the rows with the arrows and adds the highlighted one on Enter', () => {
    const h = show([TODO, DONE, BLOCKED]);
    const f = field();
    fireEvent.keyDown(f, { key: 'ArrowDown' });
    fireEvent.keyDown(f, { key: 'ArrowDown' });
    const second = screen.getAllByRole('option')[1]!;
    expect(second.getAttribute('aria-selected')).toBe('true');
    expect(f.getAttribute('aria-activedescendant')).toBe(second.id);
    // Down stops at the last row; Up past the first goes back to the field.
    fireEvent.keyDown(f, { key: 'ArrowDown' });
    fireEvent.keyDown(f, { key: 'ArrowDown' });
    expect(screen.getAllByRole('option')[2]!.getAttribute('aria-selected')).toBe('true');
    fireEvent.keyDown(f, { key: 'ArrowUp' });
    fireEvent.keyDown(f, { key: 'Enter' });
    expect(h.onPick).toHaveBeenCalledWith({ status: 'done', name: 'Done' });
    fireEvent.keyDown(f, { key: 'ArrowUp' });
    fireEvent.keyDown(f, { key: 'ArrowUp' });
    expect(f.getAttribute('aria-activedescendant')).toBeNull();
  });

  it('highlights a row under the pointer', () => {
    show([TODO, DONE]);
    fireEvent.mouseMove(screen.getAllByRole('option')[1]!);
    expect(screen.getAllByRole('option')[1]!.getAttribute('aria-selected')).toBe('true');
  });

  it('offers Add All with two or more, adding them in order', () => {
    const h = show([TODO, DONE]);
    fireEvent.click(screen.getByRole('button', { name: 'Add All' }));
    expect(h.onPickAll).toHaveBeenCalledWith([
      { status: 'todo', name: 'To do' },
      { status: 'done', name: 'Done' },
    ]);
  });

  it('narrows the rows as a name is typed, and says when none match', () => {
    show([TODO, DONE, BLOCKED]);
    fireEvent.change(field(), { target: { value: 'do' } });
    expect(screen.getAllByRole('option').map((o) => o.getAttribute('data-status'))).toEqual([
      'todo',
      'done',
    ]);
    // Add All is for the whole list, not a narrowed one.
    expect(screen.queryByRole('button', { name: 'Add All' })).toBeNull();
    fireEvent.change(field(), { target: { value: 'Shipped' } });
    expect(screen.queryAllByRole('option')).toHaveLength(0);
    expect(screen.getByText('No states match “Shipped”')).toBeTruthy();
  });

  it('uses the existing status a typed name matches, and says so', () => {
    const h = show([TODO]);
    expect(screen.queryByRole('button', { name: 'Add All' })).toBeNull();
    fireEvent.change(field(), { target: { value: 'to-do' } });
    expect(screen.getByText('Uses the existing To do status')).toBeTruthy();
    fireEvent.keyDown(field(), { key: 'Enter' });
    expect(h.onPick).toHaveBeenCalledWith({ status: 'todo', name: 'To do' });
    expect(h.onName).not.toHaveBeenCalled();
  });

  it('is the plain field without existing statuses: refuses a name on the board, makes a new one', () => {
    const h = show([]);
    expect(screen.queryByText('Existing Statuses')).toBeNull();
    expect(screen.getByText('Name a New Status')).toBeTruthy();
    expect(field().getAttribute('role')).toBeNull();
    fireEvent.keyDown(field(), { key: 'ArrowDown' });
    fireEvent.change(field(), { target: { value: 'DOING' } });
    expect(screen.getByText('This board already has Doing')).toBeTruthy();
    const add = screen.getByRole('button', { name: 'Add Column' }) as HTMLButtonElement;
    expect(add.disabled).toBe(true);
    fireEvent.keyDown(field(), { key: 'Enter' });
    expect(h.onName).not.toHaveBeenCalled();
    fireEvent.change(field(), { target: { value: 'Blocked' } });
    fireEvent.click(add);
    expect(h.onName).toHaveBeenCalledWith('Blocked');
  });
});

// docs/specs/026-plan/plan-board.md "Suggested statuses".
describe('the picker’s suggested statuses', () => {
  const suggested = () =>
    within(screen.getByRole('group', { name: 'Suggested Statuses' }))
      .getAllByRole('button')
      .map((b) => b.getAttribute('aria-label'));

  it('suggests the common statuses the board and the project lack, without existing ones', () => {
    const board = {
      columns: [{ id: 'todo', status: 'todo', name: 'To Do' }],
    } as unknown as PlanBoardSetup;
    show(
      [],
      board,
      new Map([
        ['todo', 'To Do'],
        ['done~ab12', 'done'],
      ]),
    );
    expect(suggested()).toEqual(['Add Backlog', 'Add In Progress', 'Add In Review']);
    expect(screen.getByText('Being worked on')).toBeTruthy();
  });

  it('adds one with a press, and all of them in order with Add All', () => {
    const h = show([], { columns: [] } as unknown as PlanBoardSetup);
    fireEvent.click(screen.getByRole('button', { name: 'Add In Progress' }));
    expect(h.onSuggest).toHaveBeenCalledWith(['In Progress']);
    fireEvent.click(screen.getByRole('button', { name: 'Add All' }));
    expect(h.onSuggest).toHaveBeenLastCalledWith([
      'Backlog',
      'To Do',
      'In Progress',
      'In Review',
      'Done',
    ]);
    expect(h.onName).not.toHaveBeenCalled();
  });

  it('offers no Add All for a single suggestion', () => {
    const board = {
      columns: ['Backlog', 'To Do', 'In Progress', 'In Review'].map((name, i) => ({
        id: `c${i}`,
        status: `c${i}`,
        name,
      })),
    } as unknown as PlanBoardSetup;
    show([], board);
    expect(suggested()).toEqual(['Add Done']);
    expect(screen.queryByRole('button', { name: 'Add All' })).toBeNull();
  });

  it('shows none while there are existing statuses to pick', () => {
    show([TODO]);
    expect(screen.queryByText('Suggested Statuses')).toBeNull();
  });

  it('shows no section once every suggestion is taken', () => {
    const board = {
      columns: ['Backlog', 'To Do', 'In Progress', 'In Review', 'Done'].map((name, i) => ({
        id: `c${i}`,
        status: `c${i}`,
        name,
      })),
    } as unknown as PlanBoardSetup;
    show([], board);
    expect(screen.queryByText('Suggested Statuses')).toBeNull();
    expect(document.querySelector('[data-suggested-statuses]')).toBeNull();
  });
});

describe('the picker’s words', () => {
  it('counts cards and names boards', () => {
    expect([0, 1, 7].map(cardCount)).toEqual(['No cards', '1 card', '7 cards']);
    expect(usedOn({ boards: [] })).toBe('Not on any board');
    expect(usedOn({ boards: ['A', 'B'] })).toBe('On A, B');
  });

  it('narrows by name as names compare', () => {
    expect(narrowStatuses([TODO, DONE], '  ')).toHaveLength(2);
    expect(narrowStatuses([TODO, DONE], 'TO-D').map((s) => s.status)).toEqual(['todo']);
  });
});
