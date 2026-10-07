// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { PlanBoardSetup } from '@livediagram/items';
import { AddColumnPicker } from './AddColumnPicker';

// docs/specs/026-plan/plan-board.md "The column picker".
afterEach(cleanup);

const setup = {
  columns: [{ id: 'doing', status: 'doing', name: 'Doing' }],
} as unknown as PlanBoardSetup;

function show(statusNames: ReadonlyMap<string, string>) {
  const handlers = { onPick: vi.fn(), onPickAll: vi.fn(), onName: vi.fn() };
  render(<AddColumnPicker setup={setup} statusNames={statusNames} {...handlers} />);
  return handlers;
}

describe('AddColumnPicker', () => {
  it('offers existing statuses as chips, and Add All with two or more', () => {
    const h = show(
      new Map([
        ['todo', 'To do'],
        ['done', 'Done'],
      ]),
    );
    expect(screen.getByText('Use an Existing Status')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(h.onPick).toHaveBeenCalledWith({ status: 'done', name: 'Done' });
    fireEvent.click(screen.getByRole('button', { name: 'Add All' }));
    expect(h.onPickAll).toHaveBeenCalledWith([
      { status: 'todo', name: 'To do' },
      { status: 'done', name: 'Done' },
    ]);
  });

  it('uses the existing status a typed name matches, and says so', () => {
    const h = show(new Map([['todo', 'To do']]));
    expect(screen.queryByRole('button', { name: 'Add All' })).toBeNull();
    const field = screen.getByLabelText('New column name');
    fireEvent.change(field, { target: { value: 'to-do' } });
    expect(screen.getByText('Uses the existing To do status')).toBeTruthy();
    fireEvent.keyDown(field, { key: 'Enter' });
    expect(h.onPick).toHaveBeenCalledWith({ status: 'todo', name: 'To do' });
    expect(h.onName).not.toHaveBeenCalled();
  });

  it('refuses a name the board already has, and makes a new status otherwise', () => {
    const h = show(new Map());
    expect(screen.queryByText('Use an Existing Status')).toBeNull();
    const field = screen.getByLabelText('New column name');
    fireEvent.change(field, { target: { value: 'DOING' } });
    expect(screen.getByText('This board already has Doing')).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Add Column' }) as HTMLButtonElement).disabled).toBe(
      true,
    );
    fireEvent.change(field, { target: { value: 'Blocked' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add Column' }));
    expect(h.onName).toHaveBeenCalledWith('Blocked');
  });
});
