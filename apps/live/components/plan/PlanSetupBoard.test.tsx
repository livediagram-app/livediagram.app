// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ITEM_TYPES } from '@livediagram/items';
import { PlanSetupBoard } from './PlanSetupBoard';
import { planPalette } from './plan-palette';

afterEach(cleanup);

// docs/specs/026-plan/plan-board.md "Setup Board".
const NAMES = new Map([
  ['todo', 'To Do'],
  ['done', 'Done'],
]);
const LAYOUT = { swimlaneBy: 'none' as const, fillTab: false };
const draw = (canEdit = true) => {
  const onSetUp = vi.fn();
  render(
    <PlanSetupBoard
      layout={LAYOUT}
      palette={planPalette('light', {})}
      canEdit={canEdit}
      types={ITEM_TYPES}
      statusNames={NAMES}
      onSetUp={onSetUp}
    />,
  );
  return onSetUp;
};

describe('Setup Board', () => {
  it('asks for card types first, every one on, and needs one to go on', () => {
    draw();
    expect(screen.getByRole('heading', { name: 'Setup Board' })).toBeTruthy();
    const tiles = screen.getAllByRole('checkbox', { checked: true });
    expect(tiles).toHaveLength(ITEM_TYPES.length);
    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
    expect(screen.getByText('Pick at least one card type.')).toBeTruthy();
    expect(
      (screen.getByRole('button', { name: 'Next: Columns' }) as HTMLButtonElement).disabled,
    ).toBe(true);
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
    fireEvent.click(screen.getByRole('button', { name: 'Next: Columns' }));
    const todo = screen.getByRole('button', { name: 'Add To Do' });
    expect(todo.textContent).toContain('Not on any board');
    expect(todo.textContent).toContain('No cards');
  });

  it('goes back to the card types with nothing lost', () => {
    draw();
    fireEvent.click(screen.getByRole('button', { name: 'Next: Columns' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add All' }));
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next: Columns' }));
    const columns = screen.getByRole('list', { name: 'Columns' });
    expect([...columns.querySelectorAll('li')].map((li) => li.textContent)).toEqual([
      expect.stringContaining('To Do'),
      expect.stringContaining('Done'),
    ]);
  });

  it('tells a viewer the board is not set up yet, with no steps', () => {
    draw(false);
    expect(screen.getByText(/This board is not set up yet/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Next: Columns' })).toBeNull();
  });

  it('offers Add New Card Type, and a type made there arrives ticked', () => {
    const onCreateType = vi.fn();
    const props = {
      palette: planPalette('light', {}),
      canEdit: true,
      statusNames: NAMES,
      onSetUp: vi.fn(),
      onCreateType,
      layout: LAYOUT,
    };
    const { rerender } = render(<PlanSetupBoard {...props} types={ITEM_TYPES} />);
    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add New Card Type' }));
    expect(onCreateType).toHaveBeenCalled();
    const kudos = { ...ITEM_TYPES[0]!, id: 'kudos', label: 'Kudos' };
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
        palette={planPalette('light', {})}
        canEdit
        types={ITEM_TYPES}
        statusNames={NAMES}
        onSetUp={onSetUp}
        layout={{ swimlaneBy: 'assignee', cardSize: 'compact', fillTab: true }}
        initial={{
          columns: [{ kind: 'existing', status: 'todo', name: 'To Do' }],
          typeIds: ['task'],
        }}
        otherElements={2}
        onCancel={onCancel}
      />,
    );
    expect(screen.getByText(`1 of ${ITEM_TYPES.length} card types`)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Next: Columns' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next: Layout' }));
    // The layout starts from the board as it is: its grouping, its card size, Fill Tab on and what saving deletes.
    expect(screen.getByRole('radio', { name: 'Assignee' }).getAttribute('aria-checked')).toBe(
      'true',
    );
    expect(screen.getByRole('radio', { name: 'Compact' }).getAttribute('aria-checked')).toBe(
      'true',
    );
    expect(screen.getByRole('switch', { name: /Fill Tab/ }).getAttribute('aria-checked')).toBe(
      'true',
    );
    expect(screen.getByRole('alert').textContent).toMatch(
      /2 other elements will be deleted when you save/,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Save Board' }));
    expect(onSetUp).toHaveBeenCalledWith(
      [{ kind: 'existing', status: 'todo', name: 'To Do' }],
      ['task'],
      { swimlaneBy: 'assignee', cardSize: 'compact', fillTab: true },
    );
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalled();
  });

  // docs/specs/026-plan/plan-board.md "Setup Board": a third, skippable step for the layout, Fill Tab last in it.
  it('lays the board out in a third step, which can be skipped', () => {
    const onSetUp = vi.fn();
    const props = {
      palette: planPalette('light', {}),
      canEdit: true,
      types: ITEM_TYPES,
      statusNames: NAMES,
      onSetUp,
      layout: LAYOUT,
    };
    const { rerender } = render(<PlanSetupBoard {...props} otherElements={0} />);
    expect(screen.getByText('Step 1 of 3')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Next: Columns' }));
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
    const fill = screen.getByRole('switch', { name: /Fill Tab/ });
    expect(fill.getAttribute('aria-checked')).toBe('false');
    fireEvent.click(fill);
    expect(screen.queryByRole('alert')).toBeNull();
    rerender(<PlanSetupBoard {...props} otherElements={1} />);
    expect(screen.getByRole('alert').textContent).toBe(
      'The rest of this canvas becomes unusable, and its 1 other element will be deleted when you create the board.',
    );
    // Back keeps the choices.
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next: Layout' }));
    expect(screen.getByRole('switch', { name: /Fill Tab/ }).getAttribute('aria-checked')).toBe(
      'true',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Create Board' }));
    expect(onSetUp).toHaveBeenCalledWith(expect.any(Array), expect.any(Array), {
      swimlaneBy: 'priority',
      swimlaneField: undefined,
      cardSize: 'minimal',
      fillTab: true,
    });
  });

  it('creates the board with the layout as it was when pressed straight through', () => {
    const onSetUp = draw();
    fireEvent.click(screen.getByRole('button', { name: 'Next: Columns' }));
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
    fireEvent.click(screen.getByRole('button', { name: 'Next: Columns' }));
    expect(steps.querySelector('[aria-current="step"]')?.textContent).toContain('Columns');
    // Layout is ahead: not a button yet. Card Types is done: a button back.
    expect(screen.queryByRole('button', { name: /Layout, done/ })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Card Types, done: go back' }));
    expect(steps.querySelector('[aria-current="step"]')?.textContent).toContain('Card Types');
  });
});
