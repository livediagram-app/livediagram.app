// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ITEM_TYPES } from '@liveplanner/items';
import { resetSetupDialogs } from '@/lib/setup-dialog-store';
import { PlanSetupBoard } from './PlanSetupBoard';

afterEach(() => {
  cleanup();
  resetSetupDialogs();
});

// docs/specs/026-plan/plan-board.md "Setup Board".
const NAMES = new Map([
  ['todo', 'To Do'],
  ['done', 'Done'],
]);
const LAYOUT = { swimlaneBy: 'none' as const, fillTab: false };
const draw = () => {
  const onSetUp = vi.fn();
  render(
    <PlanSetupBoard
      boardId="b"
      onClose={vi.fn()}
      layout={LAYOUT}
      types={ITEM_TYPES}
      statusNames={NAMES}
      onSetUp={onSetUp}
    />,
  );
  return onSetUp;
};

// Step 1 starts with no card type on: pick them all, then go on to the columns.
const toColumns = () => {
  fireEvent.click(screen.getByRole('button', { name: 'Select All' }));
  fireEvent.click(screen.getByRole('button', { name: 'Next: Columns' }));
};

describe('Setup Board', () => {
  it('asks for card types first, none on, and needs one to go on', () => {
    draw();
    expect(screen.getByRole('dialog', { name: 'Set up your board' })).toBeTruthy();
    expect(screen.queryAllByRole('checkbox', { checked: true })).toHaveLength(0);
    expect(screen.getByText('Pick at least one card type.')).toBeTruthy();
    const next = screen.getByRole('button', { name: 'Next: Columns' }) as HTMLButtonElement;
    expect(next.disabled).toBe(true);
    fireEvent.click(screen.getByRole('checkbox', { name: /Task/ }));
    expect(next.disabled).toBe(false);
  });

  it('then takes existing and new columns, in order, and creates the board with both', () => {
    const onSetUp = draw();
    // Only Task and Note.
    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
    fireEvent.click(screen.getByRole('checkbox', { name: /Task/ }));
    fireEvent.click(screen.getByRole('checkbox', { name: /Note/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Next: Columns' }));
    expect(screen.getByText('No columns yet. Add one below.')).toBeTruthy();
    const next = screen.getByRole('button', { name: 'Next: Layout' }) as HTMLButtonElement;
    expect(next.disabled).toBe(true);
    // An existing state's tile names it and where it is used.
    fireEvent.click(screen.getByRole('button', { name: 'Add To Do' }));
    const field = screen.getByLabelText('Add a New State');
    fireEvent.change(field, { target: { value: 'done' } });
    expect(screen.getByText(/Uses the existing Done state/)).toBeTruthy();
    fireEvent.change(field, { target: { value: 'Waiting' } });
    fireEvent.keyDown(field, { key: 'Enter' });
    fireEvent.keyDown(screen.getByRole('button', { name: 'Move Waiting' }), {
      key: 'ArrowUp',
      altKey: true,
    });
    fireEvent.click(next);
    fireEvent.click(screen.getByRole('button', { name: 'Create Board' }));
    expect(onSetUp).toHaveBeenCalledWith(
      [
        { kind: 'new', name: 'Waiting' },
        { kind: 'existing', status: 'todo', name: 'To Do' },
      ],
      ['task', 'note'],
      LAYOUT,
    );
  });

  // "Setup Board": an existing state reads as the column picker shows it (missingBoardStatuses).
  it('lists existing states as the column picker does', () => {
    draw();
    toColumns();
    const todo = screen.getByRole('button', { name: 'Add To Do' });
    expect(todo.textContent).toContain('Not on any board');
    expect(todo.textContent).toContain('No cards');
  });

  it('goes back to the card types with nothing lost', () => {
    draw();
    toColumns();
    fireEvent.click(screen.getByRole('button', { name: 'Add All' }));
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next: Columns' }));
    const columns = screen.getByRole('list', { name: 'Columns' });
    expect([...columns.querySelectorAll('li')].map((li) => li.textContent)).toEqual([
      expect.stringContaining('To Do'),
      expect.stringContaining('Done'),
    ]);
  });

  it('offers Add New Card Type, and a type made there arrives ticked', () => {
    const onCreateType = vi.fn();
    const props = {
      boardId: 'b',
      onClose: vi.fn(),
      statusNames: NAMES,
      onSetUp: vi.fn(),
      onCreateType,
      layout: LAYOUT,
    };
    const { rerender } = render(<PlanSetupBoard {...props} types={ITEM_TYPES} />);
    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add New Card Type' }));
    expect(onCreateType).toHaveBeenCalled();
    const kudos = { ...ITEM_TYPES[0], id: 'kudos', label: 'Kudos' };
    rerender(<PlanSetupBoard {...props} types={[...ITEM_TYPES, kudos]} />);
    expect(screen.getByRole('checkbox', { name: /Kudos/ }).getAttribute('aria-checked')).toBe(
      'true',
    );
    expect(screen.getByText(`1 of ${ITEM_TYPES.length + 1} card types`)).toBeTruthy();
  });

  it('starts from the board when run again, with Cancel and Save Board', () => {
    const onSetUp = vi.fn();
    const onCancel = vi.fn();
    render(
      <PlanSetupBoard
        boardId="b"
        onClose={onCancel}
        types={ITEM_TYPES}
        statusNames={NAMES}
        onSetUp={onSetUp}
        layout={{ swimlaneBy: 'assignee', cardSize: 'minimal', fillTab: true }}
        initial={{
          columns: [{ kind: 'existing', status: 'todo', name: 'To Do' }],
          typeIds: ['task'],
        }}
      />,
    );
    expect(screen.getByText(`1 of ${ITEM_TYPES.length} card types`)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Next: Columns' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next: Layout' }));
    // The layout starts from the board as it is: its grouping and its card size (a stored Fill Tab is kept).
    expect(screen.getByRole('radio', { name: 'Assignee' }).getAttribute('aria-checked')).toBe(
      'true',
    );
    expect(screen.getByRole('radio', { name: 'Minimal' }).getAttribute('aria-checked')).toBe(
      'true',
    );
    expect(screen.queryByRole('radio', { name: 'Compact' })).toBeNull();
    // No Fill Tab: a Board tab's board always fills it (docs/specs/026-plan/plan-tabs.md).
    expect(screen.queryByRole('switch', { name: /Fill Tab/ })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Save Board' }));
    expect(onSetUp).toHaveBeenCalledWith(
      [{ kind: 'existing', status: 'todo', name: 'To Do' }],
      ['task'],
      { swimlaneBy: 'assignee', cardSize: 'minimal', fillTab: true },
    );
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalled();
  });

  // docs/specs/026-plan/plan-board.md "Setup Board": a third, skippable step for the layout.
  it('lays the board out in a third step, which can be skipped', () => {
    const onSetUp = vi.fn();
    const props = {
      boardId: 'b',
      onClose: vi.fn(),
      types: ITEM_TYPES,
      statusNames: NAMES,
      onSetUp,
      layout: LAYOUT,
    };
    render(<PlanSetupBoard {...props} />);
    expect(screen.getByText('Step 1 of 3')).toBeTruthy();
    toColumns();
    const next = screen.getByRole('button', { name: 'Next: Layout' }) as HTMLButtonElement;
    expect(next.disabled).toBe(true);
    // Create Board is the Layout step's alone.
    expect(screen.queryByRole('button', { name: 'Create Board' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Add To Do' }));
    fireEvent.click(next);
    expect(screen.getByRole('heading', { name: 'Swimlanes' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Card Display' })).toBeTruthy();
    // Rows by status would repeat the columns: not offered.
    expect(screen.queryByRole('radio', { name: 'Status' })).toBeNull();
    fireEvent.click(screen.getByRole('radio', { name: 'Priority' }));
    fireEvent.click(screen.getByRole('radio', { name: 'Minimal' }));
    // Back keeps the choices.
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next: Layout' }));
    expect(screen.getByRole('radio', { name: 'Minimal' }).getAttribute('aria-checked')).toBe(
      'true',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Create Board' }));
    expect(onSetUp).toHaveBeenCalledWith(expect.any(Array), expect.any(Array), {
      swimlaneBy: 'priority',
      swimlaneField: undefined,
      cardSize: 'minimal',
      fillTab: false,
    });
  });

  it('creates the board with the layout as it was when pressed straight through', () => {
    const onSetUp = draw();
    toColumns();
    fireEvent.click(screen.getByRole('button', { name: 'Add To Do' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next: Layout' }));
    fireEvent.click(screen.getByRole('button', { name: 'Create Board' }));
    expect(onSetUp).toHaveBeenCalledWith(expect.any(Array), expect.any(Array), LAYOUT);
  });

  it('shows the steps as a stepper: the current one marked, a done one a way back', () => {
    draw();
    const steps = screen.getByRole('list', { name: 'Steps' });
    expect(steps.querySelector('[aria-current="step"]')?.textContent).toContain('Card Types');
    expect(screen.queryByText('Which cards go on it')).toBeNull();
    toColumns();
    expect(steps.querySelector('[aria-current="step"]')?.textContent).toContain('Columns');
    // Layout is ahead: not a button yet. Card Types is done: a button back.
    expect(screen.queryByRole('button', { name: /Layout, done/ })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Card Types, done: go back' }));
    expect(steps.querySelector('[aria-current="step"]')?.textContent).toContain('Card Types');
  });
});

describe('Setup Board as a dialog', () => {
  it('presses the step’s primary action on Enter, but not from a field', () => {
    const onSetUp = draw();
    const dialog = screen.getByRole('dialog');
    // Nothing picked yet: Enter does nothing.
    fireEvent.keyDown(dialog, { key: 'Enter' });
    expect(screen.getByText('Step 1 of 3')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Select All' }));
    fireEvent.keyDown(dialog, { key: 'Enter' });
    expect(screen.getByText('Step 2 of 3')).toBeTruthy();
    // The new state field's Enter adds a column, never moves on.
    const field = screen.getByLabelText('Add a New State');
    fireEvent.change(field, { target: { value: 'Waiting' } });
    fireEvent.keyDown(field, { key: 'Enter' });
    expect(screen.getByText('Step 2 of 3')).toBeTruthy();
    fireEvent.keyDown(dialog, { key: 'Enter' });
    fireEvent.keyDown(dialog, { key: 'Enter' });
    expect(onSetUp).toHaveBeenCalledWith(
      [{ kind: 'new', name: 'Waiting' }],
      expect.any(Array),
      LAYOUT,
    );
  });

  it('opens again on the step and picks it was closed on', () => {
    const { unmount } = render(
      <PlanSetupBoard
        boardId="b"
        onClose={vi.fn()}
        layout={LAYOUT}
        types={ITEM_TYPES}
        statusNames={NAMES}
        onSetUp={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole('checkbox', { name: /Task/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Next: Columns' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add To Do' }));
    unmount();
    draw();
    expect(screen.getByText('Step 2 of 3')).toBeTruthy();
    expect(screen.getByRole('list', { name: 'Columns' }).textContent).toContain('To Do');
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(screen.getByText(`1 of ${ITEM_TYPES.length} card types`)).toBeTruthy();
  });
});
