// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { presetSetup, type PlanBoardSetup } from '@liveplanner/items';
import { PlanColumnHeader } from './PlanColumnHeader';
import { PlanProvider, type PlanContextValue } from './PlanContext';
import { planPalette } from './plan-palette';

// docs/specs/026-plan/plan-board.md "A column's own settings" and "The column picker": + Add Column After opens the
// picker; the column it adds takes the settings, its name selected.

afterEach(cleanup);

function Board({
  initial,
  statusNames = new Map(),
  canEdit = true,
}: {
  initial: PlanBoardSetup;
  statusNames?: ReadonlyMap<string, string>;
  canEdit?: boolean;
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
            canEdit={canEdit}
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
    fireEvent.click(screen.getByRole('option', { name: /Shipped/ }));
    expect(
      screen.getByRole('button', { name: 'Shipped column settings' }).getAttribute('aria-expanded'),
    ).toBe('true');
  });

  // docs/specs/026-plan/plan-board.md "Suggested statuses".
  it('adds a suggested status the board lacks and moves to it', () => {
    const setup = presetSetup('kanban');
    render(<Board initial={setup} />);
    openAdd(setup);
    // Kanban has Backlog, To Do, In Progress and Done already, and Review is not In Review.
    expect(screen.queryByRole('button', { name: 'Add All' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Add In Review' }));
    expect(
      screen
        .getByRole('button', { name: 'In Review column settings' })
        .getAttribute('aria-expanded'),
    ).toBe('true');
  });

  it('adds every suggestion with Add All after the column, closing the settings', () => {
    const setup = presetSetup('todo');
    render(<Board initial={setup} />);
    openAdd(setup);
    fireEvent.click(screen.getByRole('button', { name: 'Add All' }));
    expect(
      screen
        .getAllByRole('button', { name: / column settings$/ })
        .map((b) => b.getAttribute('aria-label')),
    ).toEqual([
      'To Do column settings',
      'Backlog column settings',
      'In Progress column settings',
      'In Review column settings',
      'Done column settings',
    ]);
    expect(screen.queryByLabelText('Column name')).toBeNull();
  });

  it('offers no settings, and so no suggestions, to someone who may not edit', () => {
    render(<Board initial={presetSetup('todo')} canEdit={false} />);
    expect(screen.queryByRole('button', { name: /column settings$/ })).toBeNull();
    expect(screen.queryByText('Suggested Statuses')).toBeNull();
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

// docs/specs/004-interface-design/touch-targets.md: a column's 24px cog reaches a 44px tap area on a
// touch screen.
describe('PlanColumnHeader cog tap area', () => {
  it('pads every column cog', () => {
    render(<Board initial={presetSetup('kanban')} />);
    const cogs = screen.getAllByRole('button', { name: /column settings$/ });
    expect(cogs.length).toBeGreaterThan(0);
    for (const cog of cogs) {
      expect(cog.className).toMatch(/\btouch-target\b/);
      expect(cog.className).toMatch(/\brelative\b/);
    }
  });
});
