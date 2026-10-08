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
const draw = (canEdit = true) => {
  const onSetUp = vi.fn();
  render(
    <PlanSetupBoard
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
    const tiles = screen.getAllByRole('button', { pressed: true });
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
    fireEvent.click(screen.getByRole('button', { name: /Task/ }));
    fireEvent.click(screen.getByRole('button', { name: /Note/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Next: Columns' }));
    expect(screen.getByText('No columns yet. Add one below.')).toBeTruthy();
    const create = screen.getByRole('button', { name: 'Create Board' }) as HTMLButtonElement;
    expect(create.disabled).toBe(true);
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
    fireEvent.click(create);
    expect(onSetUp).toHaveBeenCalledWith(
      [
        { kind: 'new', name: 'Waiting' },
        { kind: 'existing', status: 'todo', name: 'To Do' },
      ],
      ['task', 'note'],
    );
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
    };
    const { rerender } = render(<PlanSetupBoard {...props} types={ITEM_TYPES} />);
    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add New Card Type' }));
    expect(onCreateType).toHaveBeenCalled();
    const kudos = { ...ITEM_TYPES[0]!, id: 'kudos', label: 'Kudos' };
    rerender(<PlanSetupBoard {...props} types={[...ITEM_TYPES, kudos]} />);
    expect(screen.getByRole('button', { name: /Kudos/ }).getAttribute('aria-pressed')).toBe('true');
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
        initial={{
          columns: [{ kind: 'existing', status: 'todo', name: 'To Do' }],
          typeIds: ['task'],
        }}
        onCancel={onCancel}
      />,
    );
    expect(screen.getByText(`1 of ${ITEM_TYPES.length} card types`)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Next: Columns' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save Board' }));
    expect(onSetUp).toHaveBeenCalledWith(
      [{ kind: 'existing', status: 'todo', name: 'To Do' }],
      ['task'],
    );
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalled();
  });
});
