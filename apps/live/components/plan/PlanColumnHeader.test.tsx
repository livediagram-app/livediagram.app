// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { presetSetup, type PlanBoardSetup } from '@livediagram/items';
import { PlanColumnHeader } from './PlanColumnHeader';
import { PlanProvider, type PlanContextValue } from './PlanContext';
import { planPalette } from './plan-palette';

// docs/specs/026-plan/plan-board.md "A column's own settings" and "The column picker": + Add Column After opens the
// picker; the column it adds takes the settings, its name selected.

afterEach(cleanup);

function Board({
  initial,
  statusNames = new Map(),
}: {
  initial: PlanBoardSetup;
  statusNames?: ReadonlyMap<string, string>;
}) {
  const [setup, setSetup] = useState(initial);
  return (
    <PlanProvider value={{ statusNames } as unknown as PlanContextValue}>
      <div>
        {setup.columns.map((column) => (
          <PlanColumnHeader
            key={column.id}
            col={{ column, count: 0, overLimit: false } as never}
            setup={setup}
            palette={planPalette('light', {})}
            canEdit
            onChange={(next) => setSetup(next)}
            onMoveCards={() => {}}
            onTrashCards={() => {}}
          />
        ))}
      </div>
    </PlanProvider>
  );
}

function openAdd(setup: PlanBoardSetup) {
  const first = setup.columns[0]!;
  fireEvent.click(screen.getByRole('button', { name: `${first.name} column settings` }));
  fireEvent.click(screen.getByRole('button', { name: 'Add Column After' }));
  return first;
}

describe('a column’s settings', () => {
  it('add a newly named column and move to it, with its name selected', () => {
    const setup = presetSetup('kanban');
    render(<Board initial={setup} />);
    const first = openAdd(setup);
    fireEvent.change(screen.getByLabelText('New column name'), { target: { value: 'Planning' } });
    fireEvent.keyDown(screen.getByLabelText('New column name'), { key: 'Enter' });
    const names = screen.getAllByLabelText('Column name') as HTMLInputElement[];
    expect(names).toHaveLength(1);
    const name = names[0]!;
    expect(name.value).toBe('Planning');
    expect(document.activeElement).toBe(name);
    expect(name.selectionStart).toBe(0);
    expect(name.selectionEnd).toBe('Planning'.length);
    expect(
      screen
        .getByRole('button', { name: 'Planning column settings' })
        .getAttribute('aria-expanded'),
    ).toBe('true');
    expect(
      screen
        .getByRole('button', { name: `${first.name} column settings` })
        .getAttribute('aria-expanded'),
    ).toBe('false');
  });

  it('add a column for an existing status the board lacks, keeping that status', () => {
    const setup = presetSetup('kanban');
    render(<Board initial={setup} statusNames={new Map([['shipped~x1', 'Shipped']])} />);
    openAdd(setup);
    fireEvent.click(screen.getByRole('button', { name: 'Shipped' }));
    expect(
      screen.getByRole('button', { name: 'Shipped column settings' }).getAttribute('aria-expanded'),
    ).toBe('true');
  });

  it('opens the picker as its own popover pointing at the button, the settings open behind it', () => {
    const setup = presetSetup('kanban');
    render(<Board initial={setup} />);
    openAdd(setup);
    const button = screen.getByRole('button', { name: 'Add Column After' });
    expect(button.getAttribute('aria-haspopup')).toBe('dialog');
    expect(button.getAttribute('aria-expanded')).toBe('true');
    const picker = screen.getByRole('dialog', { name: 'Add a Column' });
    expect(picker.hasAttribute('data-add-column-picker')).toBe(true);
    // Its own surface, not inside the settings popover.
    const settings = screen.getByRole('dialog', { name: `${setup.columns[0]!.name} column` });
    expect(settings.contains(picker)).toBe(false);
    // Focus moves into the picker.
    expect(picker.contains(document.activeElement)).toBe(true);
  });

  it('closes only the picker on Escape, giving focus back to the button; a second Escape closes the settings', () => {
    const setup = presetSetup('kanban');
    render(<Board initial={setup} />);
    const first = openAdd(setup);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: 'Add a Column' })).toBeNull();
    expect(screen.getByRole('dialog', { name: `${first.name} column` })).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Add Column After' }));
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: `${first.name} column` })).toBeNull();
  });

  it('closes the picker on a press outside it, and a press in it keeps the settings open', () => {
    const setup = presetSetup('kanban');
    render(<Board initial={setup} />);
    const first = openAdd(setup);
    fireEvent.pointerDown(screen.getByLabelText('New column name'));
    expect(screen.getByRole('dialog', { name: `${first.name} column` })).toBeTruthy();
    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole('dialog', { name: 'Add a Column' })).toBeNull();
  });
});
